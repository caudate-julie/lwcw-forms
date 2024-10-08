import { assert } from "./assert.js";

export type CellValue = string | number | boolean | Date;

let request_count = 0;

export class Client {
    deployment_url: string;

    constructor(deployment_url: string) {
        this.deployment_url = deployment_url;
    }

    async make_request<T>(action: string, args: unknown): Promise<T> {
        request_count++;
        let timer_name = `make_request #${request_count}, ${action}`;
        console.time(timer_name);
        try {
            let resp = await fetch(this.deployment_url, {
                method: "POST",
                body: JSON.stringify({ action, args }),
            });
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            let data = await resp.json();
            if (data.error) {
                throw new Error(`Server returned ${JSON.stringify(data)}`);
            }
            return data;
        } finally {
            console.timeEnd(timer_name);
        }
    }

    // keep these definitions in sync with server.js

    async get_range_values(args: {
        sheet: number | string,
        row: number,
        col: number,
        width: number | "max",
        height: number | "max",
    }): Promise<CellValue[][]> {
        assert(args.row > 0 && args.col > 0);
        assert(args.width === "max" || args.width > 0);
        assert(args.height === "max" || args.height > 0);
        return this.make_request<CellValue[][]>("get_range_values", args);
    }

    /** If any of the canaries don't match, skips updating and returns false. */
    async set_value(args: {
        sheet: number | string,
        row: number,
        col: number,
        value: CellValue | null,
        canaries?: { row: number, col: number, expected_value: CellValue }[]
    }): Promise<boolean> {
        assert(args.row > 0 && args.col > 0);
        for (let canary of args.canaries || []) {
            assert(canary.row > 0 && canary.col > 0);
        }
        return (await this.make_request<{ success: boolean }>("set_value", args)).success;
    }

    async add_column(args: {
        sheet: number | string,
        header_row: number,
        header: CellValue,
    }): Promise<number> {
        assert(args.header !== "");
        return (await this.make_request<{ col: number }>("add_column", args)).col;
    }
}
