import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_JOBS } from "./jobs.ts";
import {
  mapDrawingRevisionToSheet,
  mapProcoreRfi,
  mergeCachedLayout,
  restRoomPackFields,
} from "./procorePackMap.ts";
import {
  isDemoProjectName,
  matchProjectName,
  pickResolvedProject,
} from "./procoreProjectMatch.ts";
import type { RoomPack } from "./pack.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;
const maple = DEMO_JOBS.find((job) => job.slug === "maple-point");
assert.ok(maple);
const demoNames = DEMO_JOBS.map((job) => job.name);

test("company id is resolved per demo project name — never hardcoded", () => {
  assert.equal(isDemoProjectName("Maple Point Medical Office", demoNames), true);
  assert.equal(isDemoProjectName("Cedar Ridge Outpatient", demoNames), true);
  assert.equal(isDemoProjectName("Harbor View Tenant Fit-Out", demoNames), true);
  assert.equal(isDemoProjectName("Some Real Client Job", demoNames), false);
  assert.equal(isDemoProjectName("", demoNames), false);

  const resolved = pickResolvedProject(
    [{ id: 77, name: "Demo Co" }],
    [
      {
        companyId: "77",
        projects: [{ id: 9001, name: "Maple Point Medical Office" }],
      },
    ],
    "Maple Point Medical Office",
    demoNames,
  );
  assert.deepEqual(resolved, {
    companyId: "77",
    projectId: "9001",
    projectName: "Maple Point Medical Office",
  });

  assert.equal(
    pickResolvedProject(
      [{ id: 77 }],
      [{ companyId: "77", projects: [{ id: 1, name: "Maple Point Medical Office" }] }],
      "A production job title",
      demoNames,
    ),
    null,
  );
  assert.equal(
    matchProjectName({ name: "Maple Point Medical Office" }, "maple point medical office"),
    true,
  );
});

test("drawing revisions map to pack sheets; obsolete and non-current are skipped", () => {
  const sheet = mapDrawingRevisionToSheet({
    drawing_number: "A-101",
    revision_number: "B",
    title: "Level 1 Floor Plan",
    current: true,
    pdf_url: "https://s3.amazonaws.com/pro-core.com/prostore/a101.pdf",
    drawing_discipline: { name: "Architectural" },
  });
  assert.deepEqual(sheet, {
    id: "A-101",
    rev: "B",
    pdf: "https://s3.amazonaws.com/pro-core.com/prostore/a101.pdf",
    preview: null,
    crop: null,
    title: "Level 1 Floor Plan",
    name: "Level 1 Floor Plan",
    discipline: "architectural",
  });

  assert.equal(
    mapDrawingRevisionToSheet({
      drawing_number: "A-101",
      obsolete: true,
      current: true,
    }),
    null,
  );
  assert.equal(
    mapDrawingRevisionToSheet({ drawing_number: "A-101", current: false }),
    null,
  );
});

test("Procore RFIs map for the viewer; drafts and recycled are omitted", () => {
  const rfi = mapProcoreRfi({
    id: 44,
    number: "RFI-001",
    subject: "Panel feed clarification",
    status: "open",
  });
  assert.deepEqual(rfi, {
    id: "44",
    number: "RFI-001",
    title: "Panel feed clarification",
    status: "open",
    url: null,
  });
  assert.equal(mapProcoreRfi({ id: 1, subject: "x", status: "draft" }), null);
  assert.equal(mapProcoreRfi({ id: 2, subject: "x", status: "recycled" }), null);
});

test("REST room pack is Maple Point shaped and never a Procore submit", () => {
  const pack = restRoomPackFields({
    job: maple,
    room: "733",
    requestId: "maple-point-733",
    projectId: "9001",
    sheets: [
      {
        id: "A-101",
        rev: "A",
        pdf: "",
        title: "Level 1 Floor Plan",
        discipline: "architectural",
      },
      {
        id: "E-101",
        rev: "A",
        pdf: "",
        title: "Level 1 Power Plan",
        discipline: "electrical",
      },
    ],
    rfis: [
      {
        id: "44",
        number: "RFI-001",
        title: "Panel feed clarification",
        status: "open",
      },
    ],
  });

  assert.equal(pack.schema, "gcpullog.room_pack.v1");
  assert.equal(pack.project.name, "Maple Point Medical Office");
  assert.equal(pack.project.slug, "maple-point");
  assert.equal(pack.room.number, "733");
  assert.equal(pack.layout.sheet, "A-101");
  assert.equal(pack.rfis[0]?.number, "RFI-001");
  assert.equal(forbidden.test(JSON.stringify(pack)), false);
});

test("cached bot layout and Drive PDFs are kept when REST has metadata only", () => {
  const rest = {
    ...restRoomPackFields({
      job: maple,
      room: "733",
      requestId: "maple-point-733",
      projectId: "9001",
      sheets: [
        {
          id: "A-101",
          rev: "C",
          pdf: "",
          title: "Level 1 Floor Plan",
          discipline: "architectural",
        },
      ],
      rfis: [],
    }),
    actions: [],
  } as RoomPack;
  const cached = {
    ...rest,
    layout: {
      sheet: "A-101",
      type: "polygon",
      points: [
        [0.2, 0.2],
        [0.5, 0.2],
        [0.5, 0.5],
        [0.2, 0.5],
      ],
      locator: "Electrical Closet 101",
    },
    sheets: [
      {
        id: "A-101",
        rev: "A",
        pdf: "/packs/maple-point-a101.pdf",
        title: "Level 1 Floor Plan",
      },
    ],
  } as RoomPack;

  const merged = mergeCachedLayout(rest, cached);
  assert.equal(merged.sheets[0]?.rev, "C");
  assert.equal(merged.sheets[0]?.pdf, "/packs/maple-point-a101.pdf");
  assert.deepEqual(merged.layout.points, cached.layout.points);
  assert.equal(forbidden.test(JSON.stringify(merged)), false);
});
