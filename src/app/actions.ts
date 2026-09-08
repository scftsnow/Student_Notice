"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { executeTransfer, executeDeposit, executeWithdrawal, approvePendingPayments } from "@/lib/ledger";
import { checkIsHoliday } from "@/lib/holidays";

// --- Student Actions ---
export async function createStudent(data: {
  studentNumber: number;
  name: string;
  gender?: string;
  memo?: string;
  initialBalance?: number;
}) {
  const { studentNumber, name, gender, memo, initialBalance = 0 } = data;

  const existing = await prisma.student.findUnique({
    where: { studentNumber },
  });
  if (existing) {
    throw new Error(`이미 ${studentNumber}번 학생(${existing.name})이 존재합니다.`);
  }

  const student = await prisma.student.create({
    data: {
      studentNumber,
      name,
      gender,
      memo,
      account: {
        create: {
          accountType: "STUDENT",
          name: `${name}의 계좌`,
          balance: initialBalance,
        },
      },
    },
  });

  // Automatically append new student to all active routines
  const routines = await prisma.routine.findMany();
  for (const r of routines) {
    const count = await prisma.routineMember.count({ where: { routineId: r.id } });
    await prisma.routineMember.create({
      data: {
        routineId: r.id,
        studentId: student.id,
        orderIndex: count,
      },
    });
  }

  revalidatePath("/students");
  revalidatePath("/routines");
  revalidatePath("/economy");
  revalidatePath("/");
  return student;
}

export async function updateStudent(id: string, data: {
  studentNumber: number;
  name: string;
  gender?: string;
  memo?: string;
}) {
  const updated = await prisma.student.update({
    where: { id },
    data,
  });

  // Also sync account name
  await prisma.account.updateMany({
    where: { studentId: id },
    data: { name: `${data.name}의 계좌` },
  });

  revalidatePath("/students");
  revalidatePath("/economy");
  revalidatePath("/");
  return updated;
}

export async function toggleStudentStatus(id: string, status: "ACTIVE" | "ABSENT") {
  const updated = await prisma.student.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/students");
  revalidatePath("/routines");
  revalidatePath("/");
  return updated;
}

export async function deleteStudent(id: string) {
  await prisma.student.delete({
    where: { id },
  });
  revalidatePath("/students");
  revalidatePath("/routines");
  revalidatePath("/economy");
  revalidatePath("/");
  return { success: true };
}

// --- Routine Actions ---
export async function createRoutine(data: {
  title: string;
  description?: string;
  workersPerCycle: number;
  cycleDays: number;
  salaryAmount: number;
  salaryCycle: string;
}) {
  const count = await prisma.routine.count();
  const students = await prisma.student.findMany({ orderBy: { studentNumber: "asc" } });

  const routine = await prisma.routine.create({
    data: {
      ...data,
      order: count + 1,
      members: {
        create: students.map((s, idx) => ({
          studentId: s.id,
          orderIndex: idx,
        })),
      },
    },
  });

  revalidatePath("/routines");
  revalidatePath("/");
  return routine;
}

export async function updateRoutine(id: string, data: {
  title: string;
  description?: string;
  workersPerCycle: number;
  cycleDays: number;
  salaryAmount: number;
  salaryCycle: string;
  active: boolean;
}) {
  const updated = await prisma.routine.update({
    where: { id },
    data,
  });
  revalidatePath("/routines");
  revalidatePath("/");
  return updated;
}

export async function deleteRoutine(id: string) {
  await prisma.routine.delete({ where: { id } });
  revalidatePath("/routines");
  revalidatePath("/");
  return { success: true };
}

/**
 * Confirm daily routine execution (Check-in)
 * Handles absences, pinch-hitters, and salary triggers based on class settings
 */
export async function confirmDailyRoutine(params: {
  routineId: string;
  date: string; // YYYY-MM-DD
  assignedStudentIds: string[];
  actualStudentIds: string[]; // may include substitute pinch-hitters
  salaryAmount: number;
}) {
  const { routineId, date, assignedStudentIds, actualStudentIds, salaryAmount } = params;

  const setting = await prisma.classSetting.findUnique({
    where: { id: "singleton" },
  });

  const taxRate = setting?.defaultTaxRate || 0.1;
  const taxMethod = (setting?.taxMethod || "WITHHOLDING") as "WITHHOLDING" | "ADDITION" | "TAX_FREE";
  const salaryPayoutMode = setting?.salaryPayoutMode || "MANUAL_APPROVAL";

  // 1. Record or update RoutineHistory
  const history = await prisma.routineHistory.upsert({
    where: {
      routineId_date: {
        routineId,
        date,
      },
    },
    update: {
      assignedStudentIds: JSON.stringify(assignedStudentIds),
      actualStudentIds: JSON.stringify(actualStudentIds),
      status: "CONFIRMED",
      salaryAmount,
    },
    create: {
      routineId,
      date,
      assignedStudentIds: JSON.stringify(assignedStudentIds),
      actualStudentIds: JSON.stringify(actualStudentIds),
      status: "CONFIRMED",
      salaryAmount,
    },
  });

  const routine = await prisma.routine.findUnique({ where: { id: routineId } });
  const routineTitle = routine?.title || "당번 활동";

  // 2. Trigger salary pipeline for actual working students
  if (salaryAmount > 0) {
    for (const studentId of actualStudentIds) {
      const taxAmount = taxMethod === "WITHHOLDING" ? Math.floor(salaryAmount * taxRate) : 0;
      const netAmount = salaryAmount - taxAmount;

      if (salaryPayoutMode === "AUTO_ON_CONFIRM") {
        // Direct deposit
        const studentAccount = await prisma.account.findUnique({ where: { studentId } });
        if (studentAccount) {
          await executeDeposit({
            accountId: studentAccount.id,
            amount: salaryAmount,
            taxRate,
            memo: `${date} ${routineTitle} 급여 (자동 지급)`,
          });
        }
      } else {
        // Add to PendingPayment for teacher approval
        await prisma.pendingPayment.create({
          data: {
            title: `${date} ${routineTitle} 급여`,
            studentId,
            routineId,
            amount: salaryAmount,
            taxRate,
            taxAmount,
            netAmount,
            status: "PENDING",
            date,
          },
        });
      }
    }
  }

  revalidatePath("/routines");
  revalidatePath("/economy");
  revalidatePath("/");
  return { success: true, history };
}

// --- Notice Actions ---
export async function saveNotice(date: string, content: string, includeRoutines: boolean = true) {
  const notice = await prisma.notice.upsert({
    where: { date },
    update: { content, includeRoutines },
    create: { date, content, includeRoutines },
  });
  revalidatePath("/notice");
  revalidatePath("/");
  return notice;
}

// --- Economy Actions ---
export async function makeTransfer(params: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  memo: string;
  applyTax?: boolean;
}) {
  const setting = await prisma.classSetting.findUnique({ where: { id: "singleton" } });
  const taxRate = params.applyTax ? (setting?.defaultTaxRate || 0.1) : 0;
  const taxMethod = (setting?.taxMethod || "WITHHOLDING") as "WITHHOLDING" | "ADDITION" | "TAX_FREE";

  const res = await executeTransfer({
    fromAccountId: params.fromAccountId,
    toAccountId: params.toAccountId,
    amount: params.amount,
    memo: params.memo,
    taxRate,
    taxMethod,
  });

  revalidatePath("/economy");
  revalidatePath("/");
  return res;
}

export async function makeDeposit(params: {
  accountId: string;
  amount: number;
  memo: string;
  applyTax?: boolean;
}) {
  const setting = await prisma.classSetting.findUnique({ where: { id: "singleton" } });
  const taxRate = params.applyTax ? (setting?.defaultTaxRate || 0.1) : 0;

  const res = await executeDeposit({
    accountId: params.accountId,
    amount: params.amount,
    memo: params.memo,
    taxRate,
  });

  revalidatePath("/economy");
  revalidatePath("/");
  return res;
}

export async function makeWithdrawal(params: {
  accountId: string;
  amount: number;
  memo: string;
}) {
  const res = await executeWithdrawal({
    accountId: params.accountId,
    amount: params.amount,
    memo: params.memo,
  });

  revalidatePath("/economy");
  revalidatePath("/");
  return res;
}

export async function approvePayments(paymentIds: string[]) {
  const res = await approvePendingPayments(paymentIds);
  revalidatePath("/economy");
  revalidatePath("/");
  return res;
}

export async function rejectPayment(paymentId: string) {
  const res = await prisma.pendingPayment.update({
    where: { id: paymentId },
    data: { status: "REJECTED" },
  });
  revalidatePath("/economy");
  return res;
}

// --- Settings Actions ---
export async function updateClassSettings(data: {
  className: string;
  currencyName: string;
  defaultTaxRate: number;
  taxMethod: string;
  absencePolicy: string;
  salaryPayoutMode: string;
  allowNegativeBalance: boolean;
  themeColor: string;
  schoolHolidays: string; // JSON string
}) {
  const updated = await prisma.classSetting.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/economy");
  revalidatePath("/routines");
  return updated;
}

export async function updateCurrencyName(currencyName: string) {
  const updated = await prisma.classSetting.upsert({
    where: { id: "singleton" },
    update: { currencyName },
    create: {
      id: "singleton",
      className: "우리 반",
      currencyName,
      defaultTaxRate: 0.1,
    },
  });
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/economy");
  revalidatePath("/routines");
  return updated;
}
