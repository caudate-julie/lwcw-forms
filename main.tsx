import "./vendor/preact/debug.js"; // should be first

import { assert, bang } from "./assert.js";
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

/*
The "Contributions" sheet describes contributions and participants' interest in them.
The first two rows are headers, starting from row 3 it's one contribution per row.
The organizer, name and the description are in rows B, C and D respectively.

The columns to the very right of the sheet (starting with column J) correspond to participants.
The name of the participant is in row 2.
The cells in a participant column, starting from row 3, are either empty or have an "x" in them.
"x" means that the participant is interested in the contribution.
*/

function char_to_col(ch: string): number {
    assert(ch.length === 1 && ch >= "A" && ch <= "Z");
    return ch.charCodeAt(0) - "A".charCodeAt(0) + 1;
}

type Participant = { name: string, col: number };

function ParticipantSelector(props: { client: Client, on_select: (p: Participant) => void }) {
    let { client, on_select } = props;

    const sheet = "Contributions";
    const header_row = 2;
    const start_col = char_to_col("J");

    let [participants, set_participants] = useState<Participant[] | null>(null);
    let [field, set_field] = useState(""); // dual use: search field and new participant name
    let [adding, set_adding] = useState(false);

    useEffect(() => {
        (async () => {
            let res = await client.get_range_values({ sheet, row: header_row, col: start_col, width: "max", height: 1 });
            set_participants(res[0].map((x, i) => ({ name: x.toString(), col: start_col + i })));
        })();
    }, [client]);

    if (participants === null) {
        return <div>Loading...</div>;
    }
    let matching_participants = participants.filter(p => p.name.toLowerCase().includes(field.trim().toLowerCase()));
    let exact_match = participants.find(p => p.name === field.trim());
    return <>
        <h3>Who are you?</h3>
        <div style={{position: "sticky", top: 0, paddingTop: 10, backgroundColor: "white"}}>
            <input type="text"
                placeholder="name or filter"
                value={field}
                onInput={(e) => set_field((e.target as HTMLInputElement).value)}
            />
            <button disabled={!field.trim() || adding || !!exact_match}
                onClick={async () => {
                    let name = field.trim();
                    assert(!!name);
                    set_adding(true);
                    let col = await client.add_column({ sheet, header_row, header: name });
                    set_adding(false);
                    on_select({ col, name });
                }}
            >Add</button>
            { adding ? "adding..." : null }
            <br/>
            ({matching_participants.length} matches)
        </div>
        <table>
            <tbody>
            {matching_participants.map(({ name, col }) =>
                <tr key={col}>
                    <td>{name}</td>
                    <td>
                        <button onClick={() => on_select({ col, name })}>Select</button>
                    </td>
                </tr>
            )}
            </tbody>
        </table>
    </>
}

type Contribution = { row: number, owner: string, topic: string, description: string, interested: boolean };

function ContributionsUI(props: { client: Client, participant: Participant }) {
    let { client, participant } = props;
    let { name, col } = participant;

    const sheet = "Contributions";
    const start_row = 3;

    let [contributions, set_contributions] = useState<Contribution[] | null>(null);

    useEffect(() => {
        (async () => {
            let promise1 = client.get_range_values({ sheet, row: start_row, col: 2, width: 3, height: "max" });
            let promise2 = client.get_range_values({ sheet, row: start_row, col, width: 1, height: "max" });
            let cs = await promise1;
            let is = await promise2;
            console.log(cs.length, is.length);
            let contrs = cs.map((row, i) => ({
                row: start_row + i,
                owner: row[0].toString(),
                topic: row[1].toString(),
                description: row[2].toString(),
                interested: !!is[i][0].toString().trim(),
            })).filter(c => c.owner || c.topic || c.description || c.interested);
            set_contributions(contrs);
        })();
    }, [client]);

    let list;
    if (contributions === null) {
        list = <div>Loading...</div>;
    } else {
        list = <>
            {contributions.map(c =>
                <div key={c.row} style={{display: "flex", alignItems: "flex-start"}}>
                    <div>
                        <input type="checkbox" checked={c.interested} onChange={async (e) => {
                            let checked = (e.target as HTMLInputElement).checked;
                            set_contributions(contributions.map(c2 => c2.row === c.row ? { ...c2, interested: checked } : c2));
                            await client.set_value({ sheet, row: c.row, col, value: checked ? "x" : "" });
                        }}/>
                    </div>
                    <div>
                        <div><b>{c.topic || "no topic"}</b> {c.owner ? <>(owner: {c.owner})</> : "(no owner)"}</div>
                        <p>{c.description}</p>
                    </div>
                </div>
            )}
        </>
    }

    return <>
        <h3>What are you interested in, {name}?</h3>
        {list}
    </>;
}

function App(props: { client: Client }) {
    let { client } = props;

    let [participant, set_participant] = useState<Participant | null>(null);

    if (participant === null) {
        return <ParticipantSelector client={client} on_select={(p) => {
            console.log("selected", p);
            set_participant(p);
        }}/>;
    }

    return <ContributionsUI client={client} participant={participant}/>;
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
