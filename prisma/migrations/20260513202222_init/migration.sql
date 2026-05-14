-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `googleId` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `profile` JSON NOT NULL,
    `preferences` JSON NOT NULL,
    `stats` JSON NOT NULL,
    `onboardingCompleted` BOOLEAN NOT NULL DEFAULT false,
    `onboardingStep` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `credits` INTEGER NOT NULL,
    `description` TEXT NULL,
    `semester` VARCHAR(191) NULL,
    `academicYear` VARCHAR(191) NULL,
    `instructor` VARCHAR(191) NULL,
    `topics` JSON NOT NULL,
    `resources` JSON NOT NULL,
    `prerequisites` JSON NOT NULL,
    `difficulty` INTEGER NOT NULL DEFAULT 3,
    `estimatedTotalHours` DOUBLE NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subject_code_key`(`code`),
    INDEX `Subject_department_idx`(`department`),
    INDEX `Subject_isActive_idx`(`isActive`),
    INDEX `Subject_semester_idx`(`semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Goal` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `targetDate` DATETIME(3) NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `difficulty` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'not-started',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `topics` JSON NOT NULL,
    `resources` JSON NOT NULL,
    `prerequisites` JSON NOT NULL,
    `estimatedTotalHours` DOUBLE NOT NULL DEFAULT 0,
    `actualHoursSpent` DOUBLE NOT NULL DEFAULT 0,
    `studyGroupId` VARCHAR(191) NULL,
    `isShared` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Goal_userId_status_idx`(`userId`, `status`),
    INDEX `Goal_targetDate_idx`(`targetDate`),
    INDEX `Goal_priority_idx`(`priority`),
    INDEX `Goal_studyGroupId_idx`(`studyGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudyPlan` (
    `id` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planVersion` INTEGER NOT NULL DEFAULT 1,
    `config` JSON NOT NULL,
    `sessions` JSON NOT NULL,
    `milestones` JSON NOT NULL,
    `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `aiModel` VARCHAR(191) NULL,
    `generationPrompt` TEXT NULL,
    `lastRegenerated` DATETIME(3) NULL,
    `regenerationReason` TEXT NULL,
    `preservedSessions` JSON NOT NULL,
    `totalPlannedHours` DOUBLE NOT NULL DEFAULT 0,
    `totalCompletedHours` DOUBLE NOT NULL DEFAULT 0,
    `completionRate` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudyPlan_goalId_key`(`goalId`),
    INDEX `StudyPlan_userId_idx`(`userId`),
    INDEX `StudyPlan_planVersion_idx`(`planVersion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `topicId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(191) NOT NULL,
    `estimatedDuration` INTEGER NOT NULL,
    `difficulty` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'not-started',
    `dueDate` DATETIME(3) NULL,
    `scheduledDate` DATETIME(3) NULL,
    `scheduledTime` VARCHAR(191) NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `timeSpent` INTEGER NOT NULL DEFAULT 0,
    `isReview` BOOLEAN NOT NULL DEFAULT false,
    `reviewSchedule` JSON NULL,
    `resources` JSON NOT NULL,
    `dependsOn` JSON NOT NULL,
    `linkedTasks` JSON NOT NULL,
    `isManual` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_userId_status_idx`(`userId`, `status`),
    INDEX `Task_goalId_status_idx`(`goalId`, `status`),
    INDEX `Task_dueDate_idx`(`dueDate`),
    INDEX `Task_scheduledDate_idx`(`scheduledDate`),
    INDEX `Task_completed_idx`(`completed`),
    INDEX `Task_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Material` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `source` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NULL,
    `openaiFileId` VARCHAR(191) NULL,
    `vectorStoreId` VARCHAR(191) NULL,
    `vectorStoreFileId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ready',
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Material_userId_goalId_idx`(`userId`, `goalId`),
    INDEX `Material_openaiFileId_idx`(`openaiFileId`),
    INDEX `Material_vectorStoreId_idx`(`vectorStoreId`),
    INDEX `Material_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudySession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `plannedStartTime` DATETIME(3) NOT NULL,
    `plannedDuration` INTEGER NOT NULL,
    `actualStartTime` DATETIME(3) NULL,
    `actualEndTime` DATETIME(3) NULL,
    `actualDuration` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
    `tasks` JSON NOT NULL,
    `notes` TEXT NULL,
    `focusScore` INTEGER NOT NULL DEFAULT 0,
    `pauseCount` INTEGER NOT NULL DEFAULT 0,
    `totalPauseTime` INTEGER NOT NULL DEFAULT 0,
    `breaks` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudySession_userId_status_idx`(`userId`, `status`),
    INDEX `StudySession_goalId_idx`(`goalId`),
    INDEX `StudySession_plannedStartTime_idx`(`plannedStartTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Progress` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `week` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `plannedTime` INTEGER NOT NULL DEFAULT 0,
    `actualTime` INTEGER NOT NULL DEFAULT 0,
    `timeStudied` INTEGER NOT NULL DEFAULT 0,
    `tasksPlanned` INTEGER NOT NULL DEFAULT 0,
    `tasksCompleted` INTEGER NOT NULL DEFAULT 0,
    `tasksSkipped` INTEGER NOT NULL DEFAULT 0,
    `completionRate` DOUBLE NOT NULL DEFAULT 0,
    `topicMastery` JSON NOT NULL,
    `currentStreak` INTEGER NOT NULL DEFAULT 0,
    `burnoutScore` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'on-track',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Progress_userId_date_idx`(`userId`, `date`),
    INDEX `Progress_goalId_date_idx`(`goalId`, `date`),
    INDEX `Progress_userId_week_year_idx`(`userId`, `week`, `year`),
    INDEX `Progress_userId_month_year_idx`(`userId`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudyGroup` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `members` JSON NOT NULL,
    `inviteCode` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `sharedGoals` JSON NOT NULL,
    `settings` JSON NOT NULL,
    `leaderboard` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudyGroup_inviteCode_key`(`inviteCode`),
    INDEX `StudyGroup_ownerId_idx`(`ownerId`),
    INDEX `StudyGroup_isPublic_idx`(`isPublic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `relatedEntityId` VARCHAR(191) NULL,
    `relatedEntityType` VARCHAR(191) NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `ActivityLog_type_createdAt_idx`(`type`, `createdAt`),
    INDEX `ActivityLog_relatedEntityId_idx`(`relatedEntityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `actionUrl` VARCHAR(191) NULL,
    `relatedEntityId` VARCHAR(191) NULL,
    `relatedEntityType` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `scheduledFor` DATETIME(3) NULL,
    `sent` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_isRead_createdAt_idx`(`userId`, `isRead`, `createdAt`),
    INDEX `Notification_scheduledFor_sent_idx`(`scheduledFor`, `sent`),
    INDEX `Notification_userId_type_isRead_idx`(`userId`, `type`, `isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FixedEvent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `recurrence` JSON NOT NULL,
    `location` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FixedEvent_userId_active_idx`(`userId`, `active`),
    INDEX `FixedEvent_startTime_endTime_idx`(`startTime`, `endTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Flashcard` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NULL,
    `front` TEXT NOT NULL,
    `back` TEXT NOT NULL,
    `difficulty` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `tags` JSON NOT NULL,
    `easeFactor` DOUBLE NOT NULL DEFAULT 2.5,
    `interval` INTEGER NOT NULL DEFAULT 1,
    `repetitions` INTEGER NOT NULL DEFAULT 0,
    `lastReviewed` DATETIME(3) NULL,
    `nextReview` DATETIME(3) NOT NULL,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `incorrectCount` INTEGER NOT NULL DEFAULT 0,
    `averageResponseTime` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Flashcard_userId_goalId_idx`(`userId`, `goalId`),
    INDEX `Flashcard_nextReview_idx`(`nextReview`),
    INDEX `Flashcard_userId_nextReview_idx`(`userId`, `nextReview`),
    INDEX `Flashcard_difficulty_idx`(`difficulty`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `difficulty` VARCHAR(191) NOT NULL,
    `progress` INTEGER NOT NULL,
    `deadline` VARCHAR(191) NOT NULL,
    `hoursPerWeek` INTEGER NOT NULL,
    `goals` JSON NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
