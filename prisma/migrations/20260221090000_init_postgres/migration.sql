-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "workbookRow" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startRow" INTEGER NOT NULL,
    "endRow" INTEGER NOT NULL,
    "crmId" TEXT,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "row" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "crmId" TEXT,
    "defaultEffort" INTEGER,
    "templateS" INTEGER,
    "templateM" INTEGER,
    "templateL" INTEGER,
    "templateCustom" INTEGER,
    "templateDetail" TEXT,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "totalS" INTEGER,
    "totalM" INTEGER,
    "totalL" INTEGER,
    "totalCustom" INTEGER,
    "customTotalCell" TEXT NOT NULL,
    "overrideCount" INTEGER NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioServiceValue" (
    "id" SERIAL NOT NULL,
    "scenarioId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "s" INTEGER,
    "m" INTEGER,
    "l" INTEGER,
    "custom" INTEGER,
    "details" TEXT,

    CONSTRAINT "ScenarioServiceValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT,
    "opportunity" TEXT,
    "notes" TEXT,
    "durationYears" INTEGER NOT NULL DEFAULT 3,
    "spreadY1" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "spreadY2" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "spreadY3" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "spreadY4" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spreadY5" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementSelection" (
    "id" SERIAL NOT NULL,
    "engagementId" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "customDays" DOUBLE PRECISION,

    CONSTRAINT "EngagementSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementScenarioService" (
    "id" SERIAL NOT NULL,
    "engagementId" INTEGER NOT NULL,
    "scenarioRow" INTEGER NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "serviceId" INTEGER,
    "serviceName" TEXT NOT NULL,
    "sectionName" TEXT,
    "days" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementScenarioService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "sourcePath" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "rowsDetected" INTEGER,
    "scenariosDetected" INTEGER,
    "servicesDetected" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_workbookRow_key" ON "Section"("workbookRow");

-- CreateIndex
CREATE UNIQUE INDEX "Service_row_key" ON "Service"("row");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_name_key" ON "Scenario"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioServiceValue_scenarioId_serviceId_key" ON "ScenarioServiceValue"("scenarioId", "serviceId");

-- CreateIndex
CREATE INDEX "Engagement_ownerId_idx" ON "Engagement"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementSelection_engagementId_row_key" ON "EngagementSelection"("engagementId", "row");

-- CreateIndex
CREATE INDEX "EngagementScenarioService_engagementId_scenarioRow_idx" ON "EngagementScenarioService"("engagementId", "scenarioRow");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementScenarioService_engagementId_scenarioRow_serviceK_key" ON "EngagementScenarioService"("engagementId", "scenarioRow", "serviceKey");

-- CreateIndex
CREATE INDEX "ImportRun_userId_idx" ON "ImportRun"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioServiceValue" ADD CONSTRAINT "ScenarioServiceValue_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioServiceValue" ADD CONSTRAINT "ScenarioServiceValue_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementSelection" ADD CONSTRAINT "EngagementSelection_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementScenarioService" ADD CONSTRAINT "EngagementScenarioService_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementScenarioService" ADD CONSTRAINT "EngagementScenarioService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

