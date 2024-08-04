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

function Indicator(props: { state: "none" | "in_progress" | "success", size?: string, className?: string }) {
    let { state, size, className } = props;
    // Using <object> instead of <img> to ensure that animation restarts on state changes.
    // https://stackoverflow.com/a/44191891
    return <object
        style={{width: size, height: size, visibility: state === "none" ? "hidden" : "visible"}}
        className={className}
        type="image/svg+xml"
        tabIndex={-1}
        data={state == "success" ? "./images/success.svg" : "./images/in_progress.svg"}
    />
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

    // Dual use: search filter and new participant name
    let [field, set_field] = useState(() => localStorage.getItem("participantField") || "");
    function set_and_save_field(x: string) {
        set_field(x);
        localStorage.setItem("participantField", x);
    }

    let [participants, set_participants] = useState<Participant[] | null>(null);
    let [adding, set_adding] = useState(false);

    useEffect(() => {
        (async () => {
            let res = await client.get_range_values({ sheet, row: header_row, col: start_col, width: "max", height: 1 });
            set_participants(res[0].map((x, i) => ({ name: x.toString(), col: start_col + i })));
        })();
    }, [client]);

    if (participants === null) {
        return <Indicator state="in_progress" className="large-indicator"/>;
    }
    let matching_participants = participants.filter(p => p.name.toLowerCase().includes(field.trim().toLowerCase()));
    let exact_match = participants.find(p => p.name === field.trim());
    return <>
        <h3>Who are you?</h3>
        <div className="sticky-header">
            <div style={{display: "flex", alignItems: "center"}}>
                <input type="text"
                    placeholder="name or filter"
                    value={field}
                    disabled={adding}
                    onInput={(e) => set_and_save_field((e.target as HTMLInputElement).value)}
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
                <Indicator state={adding ? "in_progress" : "none"} className="adding-indicator"/>
            </div>
            <div className="filter-info">
            {
                field === ""
                ? <>{participants.length} total</>
                : <>
                    <span className="filter-link"
                        onClick={() => set_and_save_field("")}
                    >{participants.length} total</span>
                    {", "}
                    {matching_participants.length} {matching_participants.length == 1 ? "match" : "matches"}
                </>
            }
            </div>
        </div>
        <table>
            <tbody>
            {matching_participants.map(({ name, col }) =>
                <tr key={col}>
                    <td>{name}</td>
                    <td>
                        <button disabled={adding} onClick={() => {
                            set_and_save_field(name);
                            on_select({ col, name });
                        }}>Select</button>
                    </td>
                </tr>
            )}
            </tbody>
        </table>
    </>
}

type Contribution = {
    row: number,
    owner: string,
    topic: string,
    description: string,
    interested: boolean,
    progress: "none" | "in_progress" | "success",
};

function ContributionsUI(props: { client: Client, participant: Participant }) {
    let { client, participant } = props;
    let { name, col } = participant;

    const sheet = "Contributions";
    const start_row = 3;

    let [canary_mismatch, set_canary_mismatch] = useState(false);
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
                progress: "none" as const,
            })).filter(c => c.owner || c.topic || c.description || c.interested);
            set_contributions(contrs);
        })();
    }, [client]);

    useEffect(() => {
        (async () => {
            let actual_name = (await client.get_range_values({ sheet, row: 2 /* TODO: constant */, col, width: 1, height: 1 }))[0][0].toString();
            if (actual_name !== name) {
                set_canary_mismatch(true);
            }
        })();
    }, [client, participant]);

    if (canary_mismatch) {
        return <>
            <p>It seems the parts of the spreadsheet we are touching were just changed by someone.
            Some kinds of changes, like rearranging rows or columns, are particularly hard to reconcile.
            So we are not even going to try.</p>
            <p><b>Please reload the page.</b></p>
        </>;
    }

    let list;
    if (contributions === null) {
        list = <Indicator state="in_progress" className="large-indicator"/>
    } else {
        list = <>
            {contributions.map(c => {
                async function on_toggle(e: preact.JSX.TargetedEvent) {
                    let checked = (e.target as HTMLInputElement).checked;
                    set_contributions((contributions) => bang(contributions)
                        .map(c2 => c2.row === c.row ? { ...c2, interested: checked, progress: "in_progress" } : c2));
                    let res = await client.set_value({
                        sheet, row: c.row, col, value: checked ? "x" : "",
                        canaries: [
                            { row: 2 /* TODO: constant */, col, expected_value: name },
                            { row: c.row, col: 3 /* TODO: constant */, expected_value: c.topic },
                        ],
                    });
                    if (!res) {
                        set_canary_mismatch(true);
                        return;
                    }
                    set_contributions((contributions) => bang(contributions)
                        .map(c2 => c2.row === c.row ? { ...c2, progress: "success" } : c2));
                }
                return <div key={c.row} className="contribution" style={{display: "flex", alignItems: "flex-start"}}>
                    <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                        <input type="checkbox" checked={c.interested} onChange={on_toggle}/>
                        <Indicator state={c.progress} className="checkbox-indicator"/>
                    </div>
                    <div style={{flexGrow: 1}}>
                        <div className="contribution-header">
                            <span>{c.topic || "no topic"}</span>
                            {c.owner && <span className="contribution-owner"> (owner: {c.owner})</span>}
                        </div>
                        <p>{c.description}</p>
                    </div>
                </div>
            })}
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
