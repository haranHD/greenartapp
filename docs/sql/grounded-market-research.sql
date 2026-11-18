START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "AuthorizedSourcesJson" text NOT NULL DEFAULT '[]';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "AiReviewStatus" character varying(60) NOT NULL DEFAULT 'NotReviewed';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "AreaSqFt" numeric(20,6);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "InputArea" numeric(20,6);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "InputAreaUnit" character varying(30) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "Location" geography(Point,4326);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "PipelineVersion" character varying(50) NOT NULL DEFAULT 'Legacy';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "RequestedByUserId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "ResearchResultJson" text NOT NULL DEFAULT '{}';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "ResearchStatus" character varying(60) NOT NULL DEFAULT 'NotStarted';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "ReviewResultJson" text NOT NULL DEFAULT '{}';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "SupersedesResearchId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD "Taluk" character varying(150) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE TABLE broker_market_observations (
        "Id" uuid NOT NULL,
        "ResearchId" uuid NOT NULL,
        "ResearchVersion" uuid NOT NULL,
        "SourceCategory" character varying(50) NOT NULL,
        "BrokerId" character varying(150) NOT NULL,
        "BrokerName" character varying(150) NOT NULL,
        "ContactReference" character varying(250) NOT NULL,
        "BrokerLocality" character varying(150) NOT NULL,
        "EvidenceType" character varying(50) NOT NULL,
        "Familiarity" character varying(100) NOT NULL,
        "DocumentReference" character varying(1000) NOT NULL,
        "EvidenceNotes" character varying(6000) NOT NULL,
        "Latitude" double precision NOT NULL,
        "Longitude" double precision NOT NULL,
        "LandUsage" integer NOT NULL,
        "LowPerCent" numeric(18,2) NOT NULL,
        "TypicalPerCent" numeric(18,2),
        "HighPerCent" numeric(18,2) NOT NULL,
        "AiTypicalPerCent" numeric(18,2),
        "DifferencePercentage" numeric(18,2),
        "AssessmentDateUtc" timestamp with time zone NOT NULL,
        "VerificationStatus" text NOT NULL,
        "RecordedBy" text NOT NULL,
        "ReviewedBy" text,
        "ReviewedAtUtc" timestamp with time zone,
        "Location" geography(Point,4326),
        CONSTRAINT "PK_broker_market_observations" PRIMARY KEY ("Id"),
        CONSTRAINT ck_broker_opinion_range CHECK ("LowPerCent" > 0 AND "HighPerCent" >= "LowPerCent" AND ("TypicalPerCent" IS NULL OR ("TypicalPerCent" >= "LowPerCent" AND "TypicalPerCent" <= "HighPerCent"))),
        CONSTRAINT ck_broker_opinion_category CHECK ("SourceCategory" = 'BrokerMarketOpinion'),
        CONSTRAINT "FK_broker_market_observations_price_research_ResearchId" FOREIGN KEY ("ResearchId") REFERENCES price_research ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE TABLE market_research_evidence (
        "Id" uuid NOT NULL,
        "ResearchId" uuid NOT NULL,
        "EvidenceId" character varying(64) NOT NULL,
        "SourceCategory" character varying(50) NOT NULL,
        "SourceName" character varying(300) NOT NULL,
        "SourceUrl" character varying(4000) NOT NULL,
        "ObservationDateUtc" timestamp with time zone,
        "RetrievedAtUtc" timestamp with time zone NOT NULL,
        "OriginalPrice" numeric(20,2),
        "OriginalArea" numeric(20,6),
        "OriginalAreaUnit" character varying(30) NOT NULL,
        "AreaSqFt" numeric(20,6),
        "RatePerCent" numeric(18,2),
        "RatePerSqFt" numeric(18,2),
        "Latitude" double precision,
        "Longitude" double precision,
        "Status" character varying(60) NOT NULL,
        "ChecksJson" text NOT NULL,
        "Location" geography(Point,4326),
        CONSTRAINT "PK_market_research_evidence" PRIMARY KEY ("Id"),
        CONSTRAINT ck_research_asking_amount CHECK ("OriginalPrice" IS NULL OR "OriginalPrice" > 0),
        CONSTRAINT ck_research_asking_area CHECK ("OriginalArea" IS NULL OR "OriginalArea" > 0),
        CONSTRAINT "FK_market_research_evidence_price_research_ResearchId" FOREIGN KEY ("ResearchId") REFERENCES price_research ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE INDEX "IX_price_research_District_Taluk_LandUsage_ResearchStatus_Crea~" ON price_research ("District", "Taluk", "LandUsage", "ResearchStatus", "CreatedAtUtc");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE INDEX "IX_price_research_Location" ON price_research USING gist ("Location");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE INDEX "IX_price_research_RequestedByUserId" ON price_research ("RequestedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE UNIQUE INDEX "IX_price_research_SupersedesResearchId" ON price_research ("SupersedesResearchId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE INDEX "IX_broker_market_observations_LandUsage_AssessmentDateUtc_Veri~" ON broker_market_observations ("LandUsage", "AssessmentDateUtc", "VerificationStatus");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE INDEX "IX_broker_market_observations_Location" ON broker_market_observations USING gist ("Location");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE UNIQUE INDEX "IX_broker_market_observations_ResearchId_ResearchVersion" ON broker_market_observations ("ResearchId", "ResearchVersion");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE INDEX "IX_market_research_evidence_Location" ON market_research_evidence USING gist ("Location");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE UNIQUE INDEX "IX_market_research_evidence_ResearchId_EvidenceId" ON market_research_evidence ("ResearchId", "EvidenceId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    CREATE INDEX "IX_market_research_evidence_SourceCategory_ObservationDateUtc" ON market_research_evidence ("SourceCategory", "ObservationDateUtc");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD CONSTRAINT "FK_price_research_price_research_SupersedesResearchId" FOREIGN KEY ("SupersedesResearchId") REFERENCES price_research ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD CONSTRAINT "FK_price_research_users_RequestedByUserId" FOREIGN KEY ("RequestedByUserId") REFERENCES users (id) ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    ALTER TABLE price_research ADD CONSTRAINT ck_grounded_request_area CHECK (("InputArea" IS NULL OR "InputArea" > 0) AND ("AreaSqFt" IS NULL OR "AreaSqFt" > 0));
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117180301_AddGroundedMarketResearch') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261117180301_AddGroundedMarketResearch', '8.0.10');
    END IF;
END $EF$;
COMMIT;

