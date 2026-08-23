/**
 * Shared publish-workflow contract (TASK 035, CMS §19/§29/§30).
 *
 * A "use server" file may only export async functions, so the state
 * consumed by `useActionState` forms lives here exactly like the
 * TASK 020 content-publish precedent (content-publish.schema.ts).
 * Both publish actions (lesson and course) and the shared PublishForm
 * use this one shape.
 */

/**
 * One actionable readiness line of the publish checklist
 * (CMS §19 "show a checklist", CMS §18 "show actionable errors" —
 * never a bare "Validation failed").
 */
export type PublishCheck = {
  /** Stable identifier (also the React key / test anchor). */
  id: string;
  /** Indonesian, actionable sentence for the admin. */
  label: string;
  state: "pass" | "fail";
};

export type PublishState =
  | { status: "idle" }
  | {
      status: "error";
      /** Form-level message (auth, permission, missing, locked, …). */
      message?: string;
      /**
       * Authoritative checklist computed server-side from the
       * persisted rows at submit time — rendered in place of the
       * page-computed guidance checklist after a rejection.
       */
      checks?: PublishCheck[];
    };

export const initialPublishState: PublishState = { status: "idle" };
