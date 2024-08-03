import { Client } from "./client.js";

let deployment_id = (new URL(window.location.href)).hash.slice(1);
let deployment_url = `https://script.google.com/macros/s/${deployment_id}/exec`;
let client = new Client(deployment_url);

async function main() {
    let values = await client.get_range_values({
        sheet: 0,
        row: 1,
        col: 1,
        width: 2,
        height: 2,
    });
    console.log(values);
}
main()
