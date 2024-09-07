/** This module is responsible for data access at the application level. */

import { assert } from "./assert.js";
import type { Client } from "./client.js";

function char_to_col(ch: string): number {
    assert(ch.length === 1 && ch >= "A" && ch <= "Z");
    return ch.charCodeAt(0) - "A".charCodeAt(0) + 1;
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

const SHEET = "Contributions";
const PARTICIPANT_HEADER_ROW = 2;
const PARTICIPANT_START_COL = char_to_col("J");

const CONTRIBUTION_START_ROW = PARTICIPANT_HEADER_ROW + 1;
const CONTRIBUTION_HEADER_COL = char_to_col("B");
const CONTRIBUTION_HEADER_WIDTH = 3;
const CONTRIBUTION_TOPIC_COL = char_to_col("C");

export type Participant = {
    name: string,
    col_promise: Promise<number>,
}

export type Contribution = {
    row: number,
    topic: string,
    description: string,
    owner: string,
}

export class DomainRepo {
    client: Client;
    constructor(client: Client) {
        this.client = client;
    }

    async get_participants(): Promise<Participant[]> {
        let participants = await this.client.get_range_values({
            sheet: SHEET,
            row: PARTICIPANT_HEADER_ROW,
            col: PARTICIPANT_START_COL,
            width: "max",
            height: 1,
        });
        return participants[0].map((name, i) => ({ name: name.toString(), col_promise: Promise.resolve(i + PARTICIPANT_START_COL) }));
    }

    async get_participant_name(participant_col: number) {
        let name = await this.client.get_range_values({
            sheet: SHEET,
            row: PARTICIPANT_HEADER_ROW,
            col: participant_col,
            width: 1, height: 1,
        });
        return name[0][0].toString();
    }

    add_participants(name: string): Participant {
        let col_promise = this.client.add_column({ sheet: SHEET, header_row: PARTICIPANT_HEADER_ROW, header: name });
        return { name, col_promise };
    }

    async get_contributions(): Promise<Contribution[]> {
        let rows = await this.client.get_range_values({
            sheet: SHEET,
            row: CONTRIBUTION_START_ROW,
            col: CONTRIBUTION_HEADER_COL,
            width: CONTRIBUTION_HEADER_WIDTH,
            height: "max",
        });
        return rows.map((row, i) => ({
            row: CONTRIBUTION_START_ROW + i,
            owner: row[0].toString(),
            topic: row[1].toString(),
            description: row[2].toString(),
        }));
    }

    /** Returns set of row numbers */
    async get_interests(participant_col: number): Promise<Set<number>> {
        let res = await this.client.get_range_values({
            sheet: SHEET,
            row: CONTRIBUTION_START_ROW,
            col: participant_col,
            width: 1,
            height: "max",
        });
        let interests = new Set<number>();
        for (let i = 0; i < res.length; i++) {
            if (res[i][0].toString().trim()) {
                interests.add(i + CONTRIBUTION_START_ROW);
            }
        }
        return interests;
    }

    /** Returns flase on canaries mismatch. */
    async set_interest(participant: Participant, contribution: Contribution, interested: boolean): Promise<boolean> {
        let col = await participant.col_promise;
        return await this.client.set_value({
            sheet: SHEET,
            row: contribution.row,
            col,
            value: interested ? "x" : "",
            canaries: [
                { row: PARTICIPANT_HEADER_ROW, col, expected_value: participant.name },
                { row: contribution.row, col: CONTRIBUTION_TOPIC_COL, expected_value: contribution.topic },
            ]
        });
    }
    
    /** Returns a mapping {contribution_row: [participant_cols] } */
    async get_all_interests(): Promise<Map<number, Set<number>>> {
        let res = await this.client.get_range_values({
            sheet: SHEET,
            row: CONTRIBUTION_START_ROW,
            col: PARTICIPANT_START_COL,
            width: "max",
            height: "max",
        });
        let contribution_row_to_interests = new Map<number, Set<number>>();
        for (let i = 0; i < res.length; i++) {
            let row = CONTRIBUTION_START_ROW + i;
            let interests = new Set<number>();
            for (let j = 0; j < res[i].length; j++) {
                if (res[i][j].toString().trim()) {
                    interests.add(j + PARTICIPANT_START_COL);
                }
            }
            contribution_row_to_interests.set(row, interests);
        }
        return contribution_row_to_interests;
    }
}
