CREATE TABLE `collaborationDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int NOT NULL,
	`productId` int,
	`title` varchar(180) NOT NULL,
	`context` text NOT NULL,
	`decision` text,
	`decisionStatus` enum('pending','approved','declined') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `collaborationDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collaborationGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`outcome` text NOT NULL,
	`priority` enum('focus','next','later') NOT NULL DEFAULT 'focus',
	`goalStatus` enum('active','paused','complete') NOT NULL DEFAULT 'active',
	`targetDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborationGoals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collaborationHandoffs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int NOT NULL,
	`productId` int,
	`fromRole` enum('owner','operator_a','operator_b') NOT NULL,
	`toRole` enum('owner','operator_a','operator_b') NOT NULL,
	`title` varchar(180) NOT NULL,
	`summary` text NOT NULL,
	`asks` text,
	`handoffStatus` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborationHandoffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collaborationProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` varchar(120) NOT NULL,
	`route` varchar(255),
	`productStatus` enum('concept','in_progress','review','live','packaged') NOT NULL DEFAULT 'concept',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborationProducts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collaborationWorkItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int NOT NULL,
	`productId` int,
	`workItemType` enum('task','support') NOT NULL DEFAULT 'task',
	`assignedTo` enum('owner','operator_a','operator_b') NOT NULL DEFAULT 'owner',
	`title` varchar(180) NOT NULL,
	`detail` text,
	`workItemPriority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`workItemStatus` enum('backlog','ready','in_progress','blocked','review','done') NOT NULL DEFAULT 'ready',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborationWorkItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `collaborationDecisions` ADD CONSTRAINT `collaborationDecisions_goalId_collaborationGoals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `collaborationGoals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collaborationDecisions` ADD CONSTRAINT `collaborationDecisions_productId_collaborationProducts_id_fk` FOREIGN KEY (`productId`) REFERENCES `collaborationProducts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collaborationGoals` ADD CONSTRAINT `collaborationGoals_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collaborationHandoffs` ADD CONSTRAINT `collaborationHandoffs_goalId_collaborationGoals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `collaborationGoals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collaborationHandoffs` ADD CONSTRAINT `collaborationHandoffs_productId_collaborationProducts_id_fk` FOREIGN KEY (`productId`) REFERENCES `collaborationProducts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collaborationProducts` ADD CONSTRAINT `collaborationProducts_goalId_collaborationGoals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `collaborationGoals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collaborationWorkItems` ADD CONSTRAINT `collaborationWorkItems_goalId_collaborationGoals_id_fk` FOREIGN KEY (`goalId`) REFERENCES `collaborationGoals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collaborationWorkItems` ADD CONSTRAINT `collaborationWorkItems_productId_collaborationProducts_id_fk` FOREIGN KEY (`productId`) REFERENCES `collaborationProducts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `collaborationDecisions_goalId_idx` ON `collaborationDecisions` (`goalId`);--> statement-breakpoint
CREATE INDEX `collaborationGoals_ownerId_idx` ON `collaborationGoals` (`ownerId`);--> statement-breakpoint
CREATE INDEX `collaborationHandoffs_goalId_idx` ON `collaborationHandoffs` (`goalId`);--> statement-breakpoint
CREATE INDEX `collaborationProducts_goalId_idx` ON `collaborationProducts` (`goalId`);--> statement-breakpoint
CREATE INDEX `collaborationWorkItems_goalId_idx` ON `collaborationWorkItems` (`goalId`);--> statement-breakpoint
CREATE INDEX `collaborationWorkItems_assignedTo_idx` ON `collaborationWorkItems` (`assignedTo`);