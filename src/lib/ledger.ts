import { prisma } from "./prisma";

export interface TransferParams {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  memo: string;
  taxRate?: number; // 0.0 ~ 1.0 (e.g. 0.1 for 10%)
  taxMethod?: "WITHHOLDING" | "ADDITION" | "TAX_FREE";
}

export interface DepositWithdrawParams {
  accountId: string;
  amount: number; // positive for deposit, positive for withdrawal amount
  memo: string;
  taxRate?: number;
}

export async function getOrCreateTreasuryAccount() {
  let treasury = await prisma.account.findFirst({
    where: { accountType: "CLASS_TREASURY" },
  });

  if (!treasury) {
    treasury = await prisma.account.create({
      data: {
        accountType: "CLASS_TREASURY",
        name: "학급 국고 (세금/벌금)",
        balance: 0,
      },
    });
  }

  return treasury;
}

/**
 * Executes transfer between two accounts with optional tax deduction to the Treasury Account.
 * Guarantees atomic transaction and double-entry balance sum == 0.
 */
export async function executeTransfer(params: TransferParams) {
  const {
    fromAccountId,
    toAccountId,
    amount,
    memo,
    taxRate = 0,
    taxMethod = "WITHHOLDING",
  } = params;

  if (amount <= 0) {
    throw new Error("거래 금액은 0보다 커야 합니다.");
  }

  if (fromAccountId === toAccountId) {
    throw new Error("출금 계좌와 입금 계좌가 동일할 수 없습니다.");
  }

  const setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  return await prisma.$transaction(async (tx) => {
    const fromAccount = await tx.account.findUnique({
      where: { id: fromAccountId },
    });
    const toAccount = await tx.account.findUnique({
      where: { id: toAccountId },
    });

    if (!fromAccount || !toAccount) {
      throw new Error("계좌 정보를 찾을 수 없습니다.");
    }

    const treasury = await tx.account.findFirst({
      where: { accountType: "CLASS_TREASURY" },
    });

    if (!treasury) {
      throw new Error("학급 국고 계좌가 존재하지 않습니다.");
    }

    // Calculate tax
    let taxAmount = 0;
    let netAmount = amount;
    let totalDeductionFromSender = amount;

    if (taxMethod === "WITHHOLDING" && taxRate > 0) {
      taxAmount = Math.floor(amount * taxRate);
      netAmount = amount - taxAmount;
      totalDeductionFromSender = amount;
    } else if (taxMethod === "ADDITION" && taxRate > 0) {
      taxAmount = Math.floor(amount * taxRate);
      netAmount = amount;
      totalDeductionFromSender = amount + taxAmount;
    } else {
      // TAX_FREE
      taxAmount = 0;
      netAmount = amount;
      totalDeductionFromSender = amount;
    }

    // Check sender balance if negative balance is disallowed
    if (
      !setting?.allowNegativeBalance &&
      fromAccount.accountType === "STUDENT" &&
      fromAccount.balance < totalDeductionFromSender
    ) {
      throw new Error(
        `잔액이 부족합니다. (현재 잔액: ${fromAccount.balance}, 필요 금액: ${totalDeductionFromSender})`
      );
    }

    // 1. Create Transaction record
    const transaction = await tx.transaction.create({
      data: {
        type: "TRANSFER",
        grossAmount: amount,
        taxRate,
        taxAmount,
        netAmount,
        memo,
      },
    });

    // 2. Ledger entry: Sender (Debit/Credit: negative)
    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: fromAccount.id,
        amount: -totalDeductionFromSender,
        memo: `송금: ${toAccount.name} (${memo})`,
      },
    });

    // 3. Ledger entry: Receiver (positive)
    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: toAccount.id,
        amount: netAmount,
        memo: `입금: ${fromAccount.name} (${memo})`,
      },
    });

    // 4. Ledger entry: Treasury (if tax > 0)
    if (taxAmount > 0) {
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: treasury.id,
          amount: taxAmount,
          memo: `세금 징수 [${memo}]`,
        },
      });
      // Update treasury balance
      await tx.account.update({
        where: { id: treasury.id },
        data: { balance: { increment: taxAmount } },
      });
    }

    // 5. Update account balances
    await tx.account.update({
      where: { id: fromAccount.id },
      data: { balance: { decrement: totalDeductionFromSender } },
    });

    await tx.account.update({
      where: { id: toAccount.id },
      data: { balance: { increment: netAmount } },
    });

    return transaction;
  });
}

/**
 * Direct deposit to an account (e.g. rewards, bonus from teacher/system)
 */
export async function executeDeposit(params: DepositWithdrawParams) {
  const { accountId, amount, memo, taxRate = 0 } = params;
  if (amount <= 0) throw new Error("입금액은 0보다 커야 합니다.");

  return await prisma.$transaction(async (tx) => {
    const targetAccount = await tx.account.findUnique({
      where: { id: accountId },
    });
    if (!targetAccount) throw new Error("계좌를 찾을 수 없습니다.");

    const treasury = await tx.account.findFirst({
      where: { accountType: "CLASS_TREASURY" },
    });

    let taxAmount = 0;
    let netAmount = amount;
    if (taxRate > 0) {
      taxAmount = Math.floor(amount * taxRate);
      netAmount = amount - taxAmount;
    }

    const transaction = await tx.transaction.create({
      data: {
        type: "DEPOSIT",
        grossAmount: amount,
        taxRate,
        taxAmount,
        netAmount,
        memo,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: targetAccount.id,
        amount: netAmount,
        memo,
      },
    });

    await tx.account.update({
      where: { id: targetAccount.id },
      data: { balance: { increment: netAmount } },
    });

    if (taxAmount > 0 && treasury) {
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: treasury.id,
          amount: taxAmount,
          memo: `입금 세금 징수: ${targetAccount.name}`,
        },
      });
      await tx.account.update({
        where: { id: treasury.id },
        data: { balance: { increment: taxAmount } },
      });
    }

    return transaction;
  });
}

/**
 * Direct withdrawal / fine from an account
 */
export async function executeWithdrawal(params: DepositWithdrawParams) {
  const { accountId, amount, memo } = params;
  if (amount <= 0) throw new Error("출금/벌금액은 0보다 커야 합니다.");

  const setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  return await prisma.$transaction(async (tx) => {
    const targetAccount = await tx.account.findUnique({
      where: { id: accountId },
    });
    if (!targetAccount) throw new Error("계좌를 찾을 수 없습니다.");

    if (!setting?.allowNegativeBalance && targetAccount.balance < amount) {
      throw new Error(`잔액이 부족합니다. (현재: ${targetAccount.balance}, 출금 요청: ${amount})`);
    }

    const transaction = await tx.transaction.create({
      data: {
        type: "WITHDRAWAL",
        grossAmount: amount,
        taxRate: 0,
        taxAmount: 0,
        netAmount: amount,
        memo,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        accountId: targetAccount.id,
        amount: -amount,
        memo,
      },
    });

    await tx.account.update({
      where: { id: targetAccount.id },
      data: { balance: { decrement: amount } },
    });

    return transaction;
  });
}

/**
 * Approve pending payments (batch or individual)
 */
export async function approvePendingPayments(paymentIds: string[]) {
  if (paymentIds.length === 0) return { count: 0 };

  return await prisma.$transaction(async (tx) => {
    const pendingList = await tx.pendingPayment.findMany({
      where: {
        id: { in: paymentIds },
        status: "PENDING",
      },
      include: {
        student: {
          include: { account: true },
        },
      },
    });

    const treasury = await tx.account.findFirst({
      where: { accountType: "CLASS_TREASURY" },
    });

    let approvedCount = 0;

    for (const payment of pendingList) {
      const studentAccount = payment.student.account;
      if (!studentAccount) continue;

      const transaction = await tx.transaction.create({
        data: {
          type: "SALARY",
          grossAmount: payment.amount,
          taxRate: payment.taxRate,
          taxAmount: payment.taxAmount,
          netAmount: payment.netAmount,
          memo: payment.title,
          referenceId: payment.id,
        },
      });

      // Credit student account
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: studentAccount.id,
          amount: payment.netAmount,
          memo: payment.title,
        },
      });

      await tx.account.update({
        where: { id: studentAccount.id },
        data: { balance: { increment: payment.netAmount } },
      });

      // If tax > 0, credit treasury
      if (payment.taxAmount > 0 && treasury) {
        await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId: treasury.id,
            amount: payment.taxAmount,
            memo: `급여 세금 원천징수: ${payment.student.name} (${payment.title})`,
          },
        });

        await tx.account.update({
          where: { id: treasury.id },
          data: { balance: { increment: payment.taxAmount } },
        });
      }

      // Mark payment as APPROVED
      await tx.pendingPayment.update({
        where: { id: payment.id },
        data: { status: "APPROVED" },
      });

      approvedCount++;
    }

    return { count: approvedCount };
  });
}
