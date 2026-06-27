import 'dotenv/config';
import { Fetcher } from '../src/services/Fetcher.js';

async function main() {
    console.log("Starte Fetch für DFF...");
    const fetcher = new Fetcher();
    try {
        await fetcher.runSpecificTask('fred_dff');
        console.log("Fetch erfolgreich!");
    } catch (e) {
        console.error("Fehler:", e);
    } finally {
        await fetcher.close();
    }
}
main();
