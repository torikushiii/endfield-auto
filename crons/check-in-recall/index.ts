export default {
    name: "check-in-recall",
    expression: "0 23 * * *",
    description: "Safety check for missed sign-ins 1 hour before midnight",
    code: async () => {
        ak.Logger.info("Running sign-in recall check...");

        const endfield = ak.SKPort.get("endfield");
        if (!endfield) {
            ak.Logger.error("Endfield game instance not found");
            return;
        }

        const results = await endfield.checkIn();

        const successCount = results.filter(r => r.status === "claimed" || r.status === "already_claimed").length;
        const missedEarlierCount = results.filter(r => r.status === "claimed").length;

        ak.Logger.info("=".repeat(50));
        ak.Logger.info("Sign-in recall summary");
        ak.Logger.info(`  Accounts processed: ${results.length}`);
        ak.Logger.info(`  Total successful: ${successCount}`);

        if (missedEarlierCount > 0) {
            ak.Logger.info(`  ⚠️ ${missedEarlierCount} accounts were missed earlier and have been claimed now.`);
        }

        for (const result of results) {
            let status: string;
            switch (result.status) {
            case "claimed":
                status = "Claimed (Missed earlier!)";
                break;
            case "already_claimed":
                status = "Already claimed";
                break;
            default:
                status = `Error: ${result.error || "Unknown error"}`;
            }
            ak.Logger.info(`  - ${result.name}: ${status}`);
        }
    }
};
