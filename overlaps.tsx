import "./vendor/preact/debug.js"; // should be first

import { assert, bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useState, useEffect } from "./vendor/preact/hooks.js";
import { Client } from "./client.js";
import { DomainRepo, type Contribution } from "./repo.js";

type State = {
    contributions: Contribution[],
    contribution_rows_to_interests: Map<number, Set<number>>,
};

function App(props: { repo: DomainRepo }) {
    let { repo } = props;
    let [state, set_state] = useState<State | null>(null);
    useEffect(() => {
        (async () => {
            let contributions = repo.get_contributions();
            let cr_to_i = await repo.get_all_interests();
            let state: State = {
                contributions: (await contributions).filter(
                    (c) => c.topic !== "opening session" && c.topic !== "closing session"),
                contribution_rows_to_interests: cr_to_i,
            };
            set_state(state);
        })();
    }, [repo]);
    if (state === null) {
        return <>...</>;
    }
    let rows: preact.JSX.Element[] = [];
    for (let contr of state.contributions) {
        let interests = state.contribution_rows_to_interests.get(contr.row) || new Set();
        
        let others: [number, Contribution][] = [];
        for (let c2 of state.contributions) {
            if (c2.row !== contr.row) {
                let interests2 = state.contribution_rows_to_interests.get(c2.row) || new Set();
                let overlap = interests.intersection(interests2).size;
                if (overlap > 0) {
                    others.push([overlap, c2]);
                }
            }
        }
        others.sort((a, b) => b[0] - a[0]);
        others = others.slice(0, 10);

        let subrows = others.map(([overlap, c2]) => {
            let interests2 = state.contribution_rows_to_interests.get(c2.row) || new Set();
            return <>
                <td>{overlap}/{interests2.size}</td>
                <td>{c2.topic}</td>
            </>
        });

        rows.push(<tr className="megarow">
            <td rowSpan={subrows.length || 1}>{interests.size}</td>
            <td rowSpan={subrows.length || 1}>{contr.topic}</td>
            {subrows.length ? subrows[0] : null}
        </tr>);
        for (let subrow of subrows.slice(1)) {
            rows.push(<tr>{subrow}</tr>);
        }
    }
    return <>
        <p>This table shows each contribution alongside ten other contributions that share the most interested individuals.</p>
        <p><i>x/y</i> means there are <i>y</i> people interested in the other contribution,
        and <i>x</i> interested in both.</p>
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Contribution</th>
                    <th></th>
                    <th>Overlapping contribution</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
    </>;
}

let root = bang(document.getElementById("root"));
let deployment_id = (new URL(window.location.href)).hash.slice(1);
assert(!!deployment_id);
let deployment_url = `https://script.google.com/macros/s/${deployment_id}/exec`;
let client = new Client(deployment_url);
let repo = new DomainRepo(client);
preact.render(<App repo={repo}/>, root);
