import * as core from "@actions/core";
import {marked} from "marked";
import {readdir, readFile} from "node:fs/promises";
import {join} from "node:path";

type ChangeLogType = "text" | "html" | "markdown";
type ReleaseType = "release" | "beta" | "alpha";

const CHANGE_LOG_TYPES = new Set<ChangeLogType>(["text", "html", "markdown"]);
const RELEASE_TYPES = new Set<ReleaseType>(["release", "beta", "alpha"]);

function getValidatedInput<T extends string>(name: string, allowedValues: ReadonlySet<T>): T {
    const value = core.getInput(name);

    if (!allowedValues.has(value as T)) {
        throw new Error(`Invalid ${name}: ${value}. Expected one of: ${Array.from(allowedValues).join(", ")}`);
    }

    return value as T;
}

async function resolveChangeLog(): Promise<string> {
    const directChangeLog = core.getInput("change_log");
    const pathChangeLog = core.getInput("change_log_path");

    if (directChangeLog && directChangeLog.trim().length > 0) {
        return directChangeLog;
    }

    if (pathChangeLog && pathChangeLog.trim().length > 0) {
        return await readFile(pathChangeLog, "utf8");
    }

    return "";
}

async function convertChangeLog(changeLog: string, changeLogType: ChangeLogType): Promise<string> {
    switch (changeLogType) {
        case "text":
            return changeLog;
        case "html":
            return changeLog;
        case "markdown":
            return marked.parse(changeLog);
    }
}

async function resolveRelations(): Promise<unknown[]> {
    const directRelations = core.getInput("relations");
    const pathRelations = core.getInput("relations_path");

    if (directRelations && directRelations.trim().length > 0) {
        return JSON.parse(directRelations);
    }

    if (pathRelations && pathRelations.trim().length > 0) {
        return JSON.parse(await readFile(pathRelations, "utf8"));
    }

    return [];
}

async function upload(metadata: any, file: Buffer, fileName: string): Promise<any> {
    const formData = new FormData();
    formData.set("metadata", JSON.stringify(metadata));
    formData.set("file", new Blob([new Uint8Array(file)], {type: "application/java-archive"}), fileName);

    const response = await fetch(
        `https://minecraft.curseforge.com/api/projects/${core.getInput("project_id")}/upload-file`, {
            method: "POST",
            headers: {
                "X-Api-Token": core.getInput("token"),
                "User-Agent": `${process.env.GITHUB_REPOSITORY}/action-curseforge-release`,
            },
            body: formData
        }
    );

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.status} ${response.statusText} - ${responseText}`);
    }

    return JSON.parse(responseText);
}

async function main() {
    try {
        const rawChangeLogType: ChangeLogType = getValidatedInput("change_log_type", CHANGE_LOG_TYPES);
        const changeLogTypeToSend: Exclude<ChangeLogType, "markdown"> = rawChangeLogType === "markdown" ? "html" : rawChangeLogType;
        const releaseType: ReleaseType = getValidatedInput("release_type", RELEASE_TYPES);

        const rawChangeLog = await resolveChangeLog();
        const changeLog = await convertChangeLog(rawChangeLog, rawChangeLogType);

        const displayName = core.getInput("name");

        const gameVersions = core.getMultilineInput("game_versions").map(version => Number(version)).filter(version => Number.isFinite(version));
        const gameVersionNames = core.getMultilineInput("game_version_names").filter(name => name.trim().length > 0);

        const isMarkedForManualRelease: boolean = core.getInput("is_marked_for_manual_release") === "true";
        const relations_data = await resolveRelations();

        const metadata = {
            changelog: changeLog,
            changelogType: changeLogTypeToSend,
            displayName: displayName,
            gameVersions: gameVersions,
            gameVersionNames: gameVersionNames,
            releaseType: releaseType,
            isMarkedForManualRelease: isMarkedForManualRelease
        }

        if (relations_data.length > 0) {
            Object.assign(metadata, { relations: { projects: relations_data } })
        }

        console.log("Resolved metadata:", JSON.stringify(metadata, null, 2));

        const filesPath = core.getInput("files_path");
        const jarFiles = (await readdir(filesPath, { withFileTypes: true }))
            .filter(file => file.isFile() && file.name.endsWith(".jar"))
            .map(file => file.name);

        if (jarFiles.length === 0) {
            core.setFailed("No jar files found in the specified files path.");
            return;
        }

        for (const jarFile of jarFiles) {
            const buffer = await readFile(join(filesPath, jarFile));
            const result = await upload(metadata, buffer, jarFile);

            core.info(`Successfully uploaded file ${jarFile}`);
            core.info(`Response from CurseForge: ${JSON.stringify(result, null, 2)}`);
        }
    } catch (error) {
        core.setFailed(`Action failed. ${error}`);
    }
}

main();
