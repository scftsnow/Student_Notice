"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types";

// --- SeatLayout (자리 틀) ---

export interface SeatLayoutRecord {
  id: string;
  name: string;
  divisions: number;
  colsPerDivision: number;
  fillFrom: string;
  cellsJson: string;
  updatedAt: Date;
}

export async function saveSeatLayout(input: {
  id?: string;
  name: string;
  divisions: number;
  colsPerDivision: number;
  fillFrom: string;
  cellsJson: string;
}): Promise<ActionResult<SeatLayoutRecord>> {
  try {
    const name = input.name.trim();
    if (!name) return { success: false, error: "틀 이름을 입력해 주세요." };
    const data = {
      name,
      divisions: input.divisions,
      colsPerDivision: input.colsPerDivision,
      fillFrom: input.fillFrom,
      cellsJson: input.cellsJson,
    };
    const row = input.id
      ? await prisma.seatLayout.update({ where: { id: input.id }, data })
      : await prisma.seatLayout.create({ data });
    revalidatePath("/picks");
    return { success: true, data: row };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "자리 틀 저장 실패" };
  }
}

export async function deleteSeatLayout(id: string): Promise<ActionResult<null>> {
  try {
    await prisma.seatLayout.delete({ where: { id } });
    revalidatePath("/picks");
    return { success: true, data: null };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "자리 틀 삭제 실패" };
  }
}

// --- SeatAssignment (자리 배치 결과) ---

export interface SeatAssignmentRecord {
  id: string;
  name: string;
  layoutId: string | null;
  configJson: string;
  cellsJson: string;
  namesJson: string;
  updatedAt: Date;
}

export async function saveSeatAssignment(input: {
  id?: string;
  name: string;
  layoutId?: string | null;
  configJson: string;
  cellsJson: string;
  namesJson: string;
}): Promise<ActionResult<SeatAssignmentRecord>> {
  try {
    const name = input.name.trim();
    if (!name) return { success: false, error: "배치 결과 이름을 입력해 주세요." };
    const data = {
      name,
      layoutId: input.layoutId ?? null,
      configJson: input.configJson,
      cellsJson: input.cellsJson,
      namesJson: input.namesJson,
    };
    const row = input.id
      ? await prisma.seatAssignment.update({ where: { id: input.id }, data })
      : await prisma.seatAssignment.create({ data });
    revalidatePath("/picks");
    return { success: true, data: row };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "자리 배치 저장 실패" };
  }
}

export async function deleteSeatAssignment(id: string): Promise<ActionResult<null>> {
  try {
    await prisma.seatAssignment.delete({ where: { id } });
    revalidatePath("/picks");
    return { success: true, data: null };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "자리 배치 삭제 실패" };
  }
}

// --- GroupSet (모둠 결과) ---

export interface GroupSetRecord {
  id: string;
  name: string;
  mode: string;
  genderMode: string;
  groupsJson: string;
  namesJson: string;
  updatedAt: Date;
}

export async function saveGroupSet(input: {
  id?: string;
  name: string;
  mode: string;
  genderMode: string;
  groupsJson: string;
  namesJson: string;
}): Promise<ActionResult<GroupSetRecord>> {
  try {
    const name = input.name.trim();
    if (!name) return { success: false, error: "모둠 결과 이름을 입력해 주세요." };
    const data = {
      name,
      mode: input.mode,
      genderMode: input.genderMode,
      groupsJson: input.groupsJson,
      namesJson: input.namesJson,
    };
    const row = input.id
      ? await prisma.groupSet.update({ where: { id: input.id }, data })
      : await prisma.groupSet.create({ data });
    revalidatePath("/picks");
    return { success: true, data: row };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "모둠 결과 저장 실패" };
  }
}

export async function deleteGroupSet(id: string): Promise<ActionResult<null>> {
  try {
    await prisma.groupSet.delete({ where: { id } });
    revalidatePath("/picks");
    return { success: true, data: null };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "모둠 결과 삭제 실패" };
  }
}
