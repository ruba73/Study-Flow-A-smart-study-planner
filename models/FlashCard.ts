import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface IFlashcard {
  id: string;
  userId: string;
  goalId: string;
  topicId?: string | null;
  front: string;
  back: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  easeFactor: number;
  interval: number;
  repetitions: number;
  lastReviewed?: Date | null;
  nextReview: Date;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  averageResponseTime?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<IFlashcard>(prisma.flashcard, ["tags"]);

export const Flashcard = {
  ...baseModel,
  async review(cardId: string, quality: number, responseTime?: number) {
    const card = await this.findUnique({ where: { id: cardId } });
    if (!card) return null;

    const reviewCount = card.reviewCount + 1;
    let correctCount = card.correctCount;
    let incorrectCount = card.incorrectCount;
    let repetitions = card.repetitions;
    let interval = card.interval;
    let easeFactor = card.easeFactor;
    let averageResponseTime = card.averageResponseTime ?? null;

    if (quality >= 3) {
      correctCount += 1;
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      repetitions += 1;
    } else {
      incorrectCount += 1;
      repetitions = 0;
      interval = 1;
    }

    if (responseTime) {
      averageResponseTime = averageResponseTime
        ? (averageResponseTime * (reviewCount - 1) + responseTime) / reviewCount
        : responseTime;
    }

    easeFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );

    return this.update({
      where: { id: cardId },
      data: {
        reviewCount,
        correctCount,
        incorrectCount,
        repetitions,
        interval,
        easeFactor,
        averageResponseTime,
        lastReviewed: new Date(),
        nextReview: new Date(Date.now() + interval * 24 * 60 * 60 * 1000),
      },
    });
  },
  getDueStatus(card: IFlashcard) {
    const diffHours = (card.nextReview.getTime() - Date.now()) / (1000 * 60 * 60);
    if (diffHours < 0) return "overdue";
    if (diffHours < 24) return "due";
    return "upcoming";
  },
  async getDueCards(userId: string, goalId?: string) {
    return this.findMany({
      where: {
        userId,
        ...(goalId ? { goalId } : {}),
        nextReview: { lte: new Date() },
      },
      orderBy: { nextReview: "asc" },
    });
  },
  async getCardsByDifficulty(userId: string, difficulty: IFlashcard["difficulty"]) {
    return this.findMany({ where: { userId, difficulty } });
  },
};
