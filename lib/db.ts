import prisma from "@/lib/prisma";

export async function connectDB() {
  return prisma;
}

export { prisma };
