import "./vendor/preact/debug.js"; // should be first

import { assert, bang } from "./assert.js";
import { Client } from "./client.js";
import * as preact from "./vendor/preact/preact.js";
import { useState, useEffect } from "./vendor/preact/hooks.js";
import { DomainRepo, type Contribution, type Participant } from "./repo.js";

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

function ParticipantSelector(props: { repo: DomainRepo, on_select: (p: { name: string, col_promise: Promise<number> }) => void }) {
    let { repo, on_select } = props;

    // Dual use: search filter and new participant name
    let [field, set_field] = useState(() => localStorage.getItem("participantField") || "");
    function set_and_save_field(x: string) {
        set_field(x);
        localStorage.setItem("participantField", x);
    }

    let [participants, set_participants] = useState<Participant[] | null>(null);

    useEffect(() => {
        (async () => {
            set_participants(await repo.get_participants());
        })();
    }, [repo]);

    if (participants === null) {
        return <Indicator state="in_progress" className="large-indicator"/>;
    }
    let matching_participants = participants.filter(p => p.name.toLowerCase().includes(field.trim().toLowerCase()));
    let exact_match = participants.find(p => p.name === field.trim());
    return <>
        <h3>What is your name?</h3>
        <div className="sticky-header">
            <div style={{display: "flex", gap: 10, alignItems: "center"}}>
                <input type="text"
                    placeholder="name or filter"
                    value={field}
                    onInput={(e) => set_and_save_field((e.target as HTMLInputElement).value)}
                />
                <button disabled={!field.trim() || !!exact_match}
                    onClick={() => {
                        let name = field.trim();
                        assert(!!name);
                        on_select(repo.add_participants(name));
                    }}
                >Add</button>
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
            {matching_participants.map(({ name, col_promise }, i) =>
                <tr key={i}>
                    <td>{name}</td>
                    <td>
                        <button onClick={() => {
                            set_and_save_field(name);
                            on_select({ col_promise, name });
                        }}>Select</button>
                    </td>
                </tr>
            )}
            </tbody>
        </table>
    </>
}

type Contribution2 = Contribution & {
    interested: boolean,
    progress: "none" | "in_progress" | "success",
};

function ContributionsUI(props: { repo: DomainRepo, name: string, col_promise: Promise<number> }) {
    let { repo, name, col_promise } = props;

    let [canary_mismatch, set_canary_mismatch] = useState(false);
    let [contributions, set_contributions] = useState<Contribution2[] | null>(null);
    let [col, set_col] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            let promise1 = repo.get_contributions();
            let col = await col_promise;
            set_col(col);
            let promise2 = repo.get_interests(col);
            let cs = await promise1;
            let interests = await promise2;
            let cs2 = cs.map((c) => ({
                ...c,
                interested: interests.has(c.row),
                progress: "none" as const,
            }));
            set_contributions(cs2);
        })();
    }, [repo, name, col_promise]);

    useEffect(() => {
        if (col === null) return;
        (async () => {
            let actual_name = await repo.get_participant_name(col);
            if (actual_name !== name) {
                set_canary_mismatch(true);
            }
        })();
    }, [repo, name, col]);

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
                    let res = await repo.set_interest({ name, col_promise }, c, checked);
                    if (!res) {
                        set_canary_mismatch(true);
                        return;
                    }
                    set_contributions((contributions) => bang(contributions)
                        .map(c2 => c2.row === c.row ? { ...c2, progress: "success" } : c2));
                }
                const checkbox_id = `checkbox-${c.row}`;
                return <div key={c.row} className="contribution" style={{display: "flex", alignItems: "flex-start"}}>
                    <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                        <input id={checkbox_id} type="checkbox" checked={c.interested} onChange={on_toggle}/>
                        <Indicator state={c.progress} className="checkbox-indicator"/>
                    </div>
                    <div style={{flexGrow: 1}}>
                        <label htmlFor={checkbox_id} className="contribution-header" style={{cursor: 'pointer'}}>
                            <span>{c.topic || "no topic"}</span>
                            {c.owner && <span className="contribution-owner"> (owner: {c.owner})</span>}
                        </label>
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

function App(props: { repo: DomainRepo }) {
    let { repo } = props;

    let [participant, set_participant] = useState<{ name: string, col_promise: Promise<number> } | null>(null);

    if (participant === null) {
        return <ParticipantSelector repo={repo} on_select={(p) => {
            console.log("selected", p);
            set_participant(p);
        }}/>;
    }

    return <ContributionsUI repo={repo} {...participant}/>;
}

let root = bang(document.getElementById("root"));
let deployment_id = (new URL(window.location.href)).hash.slice(1);
if (deployment_id) {
    let deployment_url = `https://script.google.com/macros/s/${deployment_id}/exec`;
    let client = new Client(deployment_url);
    let repo = new DomainRepo(client);
    preact.render(<App repo={repo}/>, root);
} else {
    preact.render(<DeploymentIdPrompt />, root);
}
