import "./vendor/preact/debug.js"; // should be first

import { bang } from "./assert.js";
import { Client } from "./client.js";
import * as preact from "./vendor/preact/preact.js";
import { useState, useEffect } from "./vendor/preact/hooks.js";

function DeploymentIdPrompt() {
    return <>
        <input type="text" placeholder="Secret deployment ID"/>
        <button onClick={() => {
            let deployment_id = (document.querySelector("input") as HTMLInputElement).value;
            window.location.hash = deployment_id;
            window.location.reload();
        }}>Go</button>
    </>;
}

function App(props: { client: Client }) {
    let { client } = props;

    let [res, setRes] = useState("loading...");
    useEffect(() => {
        client.get_range_values({ sheet: "Sheet1", row: 1, col: 1, width: 2, height: 2})
            .then((res) => setRes(JSON.stringify(res)));
    }, []);

    return <div>hello {res}</div>;
}

let root = bang(document.getElementById("root"));
let deployment_id = (new URL(window.location.href)).hash.slice(1);
if (deployment_id) {
    let deployment_url = `https://script.google.com/macros/s/${deployment_id}/exec`;
    let client = new Client(deployment_url);
    preact.render(<App client={client}/>, root);
} else {
    preact.render(<DeploymentIdPrompt />, root);
}
