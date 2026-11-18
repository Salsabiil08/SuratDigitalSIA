import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { jakartaDate } from "../src/domain/workflow";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
const db = new PGlite();
const actor = (n: number) =>
  `a0000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let letterId: string;
let extId: string;
let billingId: string;
const rows = async (sql: string, params: any[] = []) =>
  (await db.query<any>(sql, params)).rows;
const run = async (sql: string, params: any[] = []) => {
  await db.query(sql, params);
};
const get = async (id: string) => {
  const l = (await rows("select * from letters where id=$1", [id]))[0];
  if (l?.letter_date instanceof Date)
    l.letter_date = l.letter_date.toISOString().slice(0, 10);
  return l;
};
const act = async (id: string, n: number, action: string, note?: string) => {
  const l = await get(id);
  return run("select review_letter($1,$2,$3,$4,$5)", [
    actor(n),
    id,
    action,
    l.revision,
    note || null,
  ]);
};
const draft = async (
  n: number,
  type: string,
  signers: number[] = [],
  extra: any = {},
) => {
  const p = {
    source: "CREATE",
    categoryCode: "PEMBERITAHUAN",
    letterTypeCode: type,
    subject: "Uji revisi",
    letterDate: jakartaDate(),
    recipientUserId: actor(3),
    recipientName: "Penerima Uji",
    recipientOrg: "Instansi Uji",
    recipientAddress: "Alamat Uji",
    content: "Naskah uji",
    signatureMode: "IN_APP",
    signerIds: signers.map(actor),
    areas: [],
    ...extra,
  };
  return (
    await rows("select save_letter_draft($1,$2::jsonb,$3::jsonb) id", [
      actor(n),
      JSON.stringify(p),
      JSON.stringify({
        path: actor(n) + "/test.docx",
        format: "DOCX",
        hash: "hash",
      }),
    ])
  )[0].id as string;
};
const issue = async (id: string, n: number, key: string) => {
  await run("select issue_letter_number($1,$2,$3)", [id, actor(n), key]);
  const l = await get(id);
  await run("select record_numbered_document($1,$2,$3,$4::jsonb)", [
    actor(n),
    id,
    l.current_version_id,
    JSON.stringify({
      path: "numbered.docx",
      format: "DOCX",
      hash: "numbered-hash",
    }),
  ]);
};
beforeAll(async () => {
  await db.exec(readFileSync("supabase/tests/00_stub_supabase.sql", "utf8"));
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec(
    "insert into master_bank(name,is_active) values('Bank Uji',true)",
  );
}, 30000);
afterAll(() => db.close());
describe.sequential("Database: alur nyata dengan akun berbeda", () => {
  it("RPC sensitif tidak dapat dipanggil anon atau authenticated", async () => {
    for (const fn of [
      "save_letter_draft(uuid,jsonb,jsonb)",
      "review_letter(uuid,uuid,text,integer,text)",
      "issue_letter_number(uuid,uuid,text)",
      "record_signature(uuid,uuid,integer,uuid,jsonb,text,text,text)",
      "finalize_letter(uuid,uuid,integer,boolean)",
      "record_numbered_document(uuid,uuid,uuid,jsonb)",
    ]) {
      const r = (
        await rows(
          "select has_function_privilege('anon',$1,'execute') a,has_function_privilege('authenticated',$1,'execute') u",
          [fn],
        )
      )[0];
      expect(r.a).toBe(false);
      expect(r.u).toBe(false);
    }
  });
  it("membuat draft tanpa nomor, tanpa preview pengajuan ditolak", async () => {
    letterId = await draft(5, "IN");
    expect((await get(letterId)).official_number).toBeNull();
    await expect(act(letterId, 5, "SUBMIT")).rejects.toThrow(/preview|pratinjau/i);
  });
  it("membatasi pengeditan, tanggal mundur, dan perubahan oleh akun lain", async () => {
    await expect(
      draft(5, "IN", [], { letterDate: "2026-01-01", dateReason: "Koreksi" }),
    ).rejects.toThrow(/kewenangan/);
    const id = await draft(4, "IN", [], {
      letterDate: "2026-01-01",
      dateReason: "Koreksi pejabat",
    });
    const l = await get(id);
    expect(l.letter_date).toBe("2026-01-01");
    await expect(
      draft(5, "IN", [], { id, revision: l.revision }),
    ).rejects.toThrow(/diubah/);
  });
  it("internal tanpa TTD dapat siap, nomor atomik idempoten dan final", async () => {
    await act(letterId, 5, "PREVIEW");
    await act(letterId, 5, "SUBMIT");
    await expect(
      run("select issue_letter_number($1,$2,$3)", [
        letterId,
        actor(4),
        "unauthorized",
      ]),
    ).rejects.toThrow(/pembuat/);
    await issue(letterId, 5, "internal");
    const num = (await get(letterId)).official_number;
    await run("select issue_letter_number($1,$2,$3)", [
      letterId,
      actor(5),
      "retry",
    ]);
    expect((await get(letterId)).official_number).toBe(num);
    await run("select finalize_letter($1,$2,$3,false)", [
      actor(5),
      letterId,
      (await get(letterId)).revision,
    ]);
    await expect(
      run("update letters set subject='ubah' where id=$1", [letterId]),
    ).rejects.toThrow(/terkunci/);
  });
  it("eksternal wajib penandatangan sah dan field penerima", async () => {
    await expect(draft(5, "KRE", [4])).rejects.toThrow(/SM\/Direktur/);
    await expect(draft(5, "KRE", [])).rejects.toThrow(/satu penandatangan/);
    await expect(
      draft(5, "KRE", [2], { recipientAddress: "" }),
    ).rejects.toThrow(/alamat/);
    extId = await draft(5, "KRE", [2]);
    await act(extId, 5, "PREVIEW");
    await act(extId, 5, "SUBMIT");
    expect((await get(extId)).status).toBe("IN_REVIEW");
  });
  it("hanya penyetuju aktif dapat menyetujui; approval tidak menerbitkan nomor", async () => {
    await expect(act(extId, 3, "APPROVE")).rejects.toThrow(/penyetuju/);
    await act(extId, 2, "APPROVE");
    expect((await get(extId)).status).toBe("READY_TO_ISSUE");
    expect((await get(extId)).official_number).toBeNull();
    await issue(extId, 5, "external");
    expect(
      (
        await rows(
          "select * from signature_requests where letter_id=$1 and status='PENDING'",
          [extId],
        )
      ).length,
    ).toBe(1);
  });
  it("menolak finalisasi sebelum TTD, aktor salah, dan preview versi kedaluwarsa", async () => {
    let l = await get(extId);
    await expect(
      run("select finalize_letter($1,$2,$3,false)", [
        actor(5),
        extId,
        l.revision,
      ]),
    ).rejects.toThrow(/TTD/);
    const s = (
      await rows("select * from signature_requests where letter_id=$1", [extId])
    )[0];
    const params = [
      actor(2),
      s.id,
      l.revision,
      l.current_version_id,
      JSON.stringify({ path: "signed.docx", hash: "h2", format: "DOCX" }),
      "IMAGE",
      "image.png",
      null,
    ];
    await expect(
      run("select record_signature($1,$2,$3,$4,$5::jsonb,$6,$7,$8)", [
        actor(3),
        ...params.slice(1),
      ]),
    ).rejects.toThrow(/penandatangan/);
    await expect(
      run("select record_signature($1,$2,$3,$4,$5::jsonb,$6,$7,$8)", [
        actor(2),
        s.id,
        999,
        ...params.slice(3),
      ]),
    ).rejects.toThrow(/berubah/);
    await run(
      "select record_signature($1,$2,$3,$4,$5::jsonb,$6,$7,$8)",
      params,
    );
    l = await get(extId);
    expect(l.signature_status).toBe("UPLOADED");
    await run("select finalize_letter($1,$2,$3,false)", [
      actor(5),
      extId,
      l.revision,
    ]);
  });
  it("tagihan: Finance, lampiran wajib, SM Finance lalu Direktur", async () => {
    const bank = (await rows("select id from master_bank limit 1"))[0]?.id;
    const billing = {
      bankId: bank,
      accountNumber: "000000",
      accountHolder: "UJI",
      items: [
        { description: "Uji 1", amount: 1 },
        { description: "Uji 2", amount: 2 },
      ],
    };
    await expect(draft(5, "Tag", [3, 2], { billing })).rejects.toThrow(
      /Finance/,
    );
    billingId = await draft(6, "Tag", [3, 2], { billing });
    await act(billingId, 6, "PREVIEW");
    await expect(act(billingId, 6, "SUBMIT")).rejects.toThrow(/lampiran/i);
    await run(
      "insert into letter_attachments(letter_id,file_name,storage_path,mime_type,size_bytes,uploaded_by) values($1,'bukti.pdf','bukti','application/pdf',100,$2)",
      [billingId, actor(6)],
    );
    await act(billingId, 6, "SUBMIT");
    await expect(act(billingId, 2, "APPROVE")).rejects.toThrow(/penyetuju/);
    await act(billingId, 3, "APPROVE");
    await act(billingId, 2, "APPROVE");
    await issue(billingId, 6, "bill");
    const reqs = await rows(
      "select * from signature_requests where letter_id=$1 order by sign_order",
      [billingId],
    );
    let l = await get(billingId);
    await expect(
      run("select record_signature($1,$2,$3,$4,$5::jsonb,$6,$7,$8)", [
        actor(2),
        reqs[1].id,
        l.revision,
        l.current_version_id,
        JSON.stringify({ path: "b2.docx", hash: "x", format: "DOCX" }),
        "IMAGE",
        "sig.png",
        null,
      ]),
    ).rejects.toThrow(/penandatangan/);
    await run("select record_signature($1,$2,$3,$4,$5::jsonb,$6,$7,$8)", [
      actor(3),
      reqs[0].id,
      l.revision,
      l.current_version_id,
      JSON.stringify({ path: "b1.docx", hash: "x", format: "DOCX" }),
      "IMAGE",
      "sig.png",
      "stamp.png",
    ]);
    l = await get(billingId);
    expect(l.signature_status).toBe("WAITING");
    await run("select record_signature($1,$2,$3,$4,$5::jsonb,$6,$7,$8)", [
      actor(2),
      reqs[1].id,
      l.revision,
      l.current_version_id,
      JSON.stringify({ path: "b2.docx", hash: "y", format: "DOCX" }),
      "IMAGE",
      "sig.png",
      null,
    ]);
    expect((await get(billingId)).signature_status).toBe("UPLOADED");
    expect(
      (
        await rows(
          "select * from audit_logs where letter_id=$1 and action='STAMP_APPLIED'",
          [billingId],
        )
      ).length,
    ).toBe(1);
  });
  it("revisi menjaga approval lama dan tanggal surat saat edit", async () => {
    const id = await draft(4, "IN", [3], {
      letterDate: "2026-01-01",
      dateReason: "Koreksi",
    });
    await act(id, 4, "PREVIEW");
    await act(id, 4, "SUBMIT");
    await expect(act(id, 3, "REQUEST_REVISION")).rejects.toThrow(/Alasan/);
    await act(id, 3, "REQUEST_REVISION", "Koreksi isi");
    const l = await get(id);
    await draft(4, "IN", [3], {
      id,
      revision: l.revision,
      letterDate: l.letter_date,
      subject: "Dikoreksi",
    });
    expect((await get(id)).letter_date).toBe("2026-01-01");
    await act(id, 4, "PREVIEW");
    await act(id, 4, "SUBMIT");
    const steps = await rows(
      "select cycle,status from approval_steps where letter_id=$1 order by cycle",
      [id],
    );
    expect(steps.map((s) => s.status)).toEqual([
      "REVISION_REQUESTED",
      "PENDING",
    ]);
  });
  it("penolakan terminal dan jalur luar memerlukan konfirmasi terpisah", async () => {
    const reject = await draft(5, "KRE", [2]);
    await act(reject, 5, "PREVIEW");
    await act(reject, 5, "SUBMIT");
    await act(reject, 2, "REJECT", "Tidak sesuai");
    await expect(act(reject, 5, "SUBMIT")).rejects.toThrow();
    const id = await draft(5, "KRE", [2], { signatureMode: "EXTERNAL" });
    await act(id, 5, "PREVIEW");
    await act(id, 5, "SUBMIT");
    await act(id, 2, "APPROVE");
    await issue(id, 5, "wet");
    expect(
      (await rows("select * from signature_requests where letter_id=$1", [id]))
        .length,
    ).toBe(0);
    const l = await get(id);
    await expect(
      run("select finalize_letter($1,$2,$3,false)", [actor(5), id, l.revision]),
    ).rejects.toThrow(/Konfirmasi/);
    await run("select finalize_letter($1,$2,$3,true)", [
      actor(5),
      id,
      l.revision,
    ]);
  });
  it("pembatalan resmi menjaga nomor, alasan dan kewenangan; Super Admin tidak otomatis berwenang", async () => {
    const id = await draft(5, "IN");
    await act(id, 5, "PREVIEW");
    await act(id, 5, "SUBMIT");
    await issue(id, 5, "cancel-test");
    const num = (await get(id)).official_number;
    await expect(
      run("select cancel_letter_workflow($1,$2,$3,$4)", [
        actor(6),
        id,
        "REQUEST",
        "Uji",
      ]),
    ).rejects.toThrow(/pembuat/);
    await run("select cancel_letter_workflow($1,$2,$3,$4)", [
      actor(5),
      id,
      "REQUEST",
      "Uji pembatalan",
    ]);
    await expect(
      run("select cancel_letter_workflow($1,$2,$3,$4)", [
        actor(2),
        id,
        "APPROVE",
        null,
      ]),
    ).rejects.toThrow(/otorisasi/);
    await run("select cancel_letter_workflow($1,$2,$3,$4)", [
      actor(4),
      id,
      "APPROVE",
      "Sesuai kewenangan kepala unit",
    ]);
    expect((await get(id)).status).toBe("CANCELLED");
    expect((await get(id)).official_number).toBe(num);
  });
  it("menolak rincian tagihan kosong dan konfirmasi luar null", async () => {
    const bank = (await rows("select id from master_bank limit 1"))[0].id;
    await expect(
      draft(6, "Tag", [3, 2], {
        billing: { bankId: bank, accountNumber: "UJI", accountHolder: "UJI" },
      }),
    ).rejects.toThrow(/rincian/i);
    const id = await draft(5, "KRE", [2], { signatureMode: "EXTERNAL" });
    await act(id, 5, "PREVIEW");
    await act(id, 5, "SUBMIT");
    await act(id, 2, "APPROVE");
    await issue(id, 5, "null-guard");
    const l = await get(id);
    await expect(
      run("select finalize_letter($1,$2,$3,$4)", [
        actor(5),
        id,
        l.revision,
        null,
      ]),
    ).rejects.toThrow(/Konfirmasi/);
  });
});

describe.sequential("Disposisi: surat kembali untuk diperiksa pemberi", () => {
  let id: string, response: string;
  const disp = async () =>
    (await rows("select * from dispositions where id=$1", [id]))[0];
  const move = async (n: number, action: string, note = "") =>
    run("select disposition_workflow($1,$2,$3,$4,$5::jsonb)", [
      actor(n),
      action,
      id,
      (await disp()).revision,
      JSON.stringify({ note }),
    ]);
  it("staf dan admin tanpa jabatan tidak dapat memberi disposisi, GM tidak lintas unit", async () => {
    const create = (n: number, r: number) =>
      rows("select disposition_workflow($1,'CREATE',null,null,$2::jsonb)", [
        actor(n),
        JSON.stringify({
          recipientId: actor(r),
          subject: "Uji disposisi",
          instruction: "Buat surat tindak lanjut",
          priority: "NORMAL",
          requiresLetter: true,
        }),
      ]);
    await expect(create(5, 6)).rejects.toThrow(/jabatan/);
    await expect(create(1, 5)).rejects.toThrow(/penugasan/);
    await expect(create(4, 6)).rejects.toThrow(/kewenangan/);
    id = (await create(4, 5))[0].disposition_workflow;
    expect((await disp()).status).toBe("NEW");
    expect((await disp()).letter_id).toBeNull();
  });
  it("penerima tidak dapat menutup sendiri atau mengirim sebelum surat selesai", async () => {
    await expect(move(5, "ACCEPT")).rejects.toThrow(/kewenangan/);
    await expect(move(6, "START")).rejects.toThrow(/berwenang/);
    await expect(move(5, "SUBMIT", "Sudah dikerjakan")).rejects.toThrow(
      /Selesaikan surat/,
    );
    response = await draft(5, "IN", [], { dispositionId: id });
    expect((await disp()).response_letter_id).toBe(response);
    await expect(draft(6, "IN", [], { dispositionId: id })).rejects.toThrow(
      /penerima/,
    );
    await expect(draft(5, "IN", [], { dispositionId: id })).rejects.toThrow(
      /Lanjutkan/,
    );
    await act(response, 5, "PREVIEW");
    await act(response, 5, "SUBMIT");
    await issue(response, 5, "disposition-test");
    await expect(move(5, "SUBMIT", "Hasil")).rejects.toThrow(
      /Selesaikan surat/,
    );
    const l = await get(response);
    await run("select finalize_letter($1,$2,$3,false)", [
      actor(5),
      response,
      l.revision,
    ]);
    await move(5, "SUBMIT", "Surat tindak lanjut selesai");
    expect((await disp()).status).toBe("IN_REVIEW");
  });
  it("RLS hanya peserta, surat hasil dapat dibaca pemberi, penerima tidak bisa menyetujui hasil", async () => {
    await run("select set_config('request.jwt.claim.sub',$1,false)", [
      actor(4),
    ]);
    expect(
      (await rows("select app.can_read_letter($1) yes", [response]))[0].yes,
    ).toBe(true);
    await run("select set_config('request.jwt.claim.sub',$1,false)", [
      actor(6),
    ]);
    expect(
      (await rows("select app.can_read_letter($1) yes", [response]))[0].yes,
    ).toBe(false);
    await db.exec("grant select on dispositions to authenticated");
    await db.exec("set role authenticated");
    try {
      expect(
        (await rows("select id from dispositions where id=$1", [id])).length,
      ).toBe(0);
    } finally {
      await db.exec("reset role");
    }
    await expect(move(5, "ACCEPT")).rejects.toThrow(/kewenangan/);
    await expect(move(4, "RETURN")).rejects.toThrow(/perlu diperbaiki/);
    await move(4, "RETURN", "Perbaiki tujuan surat");
    expect((await disp()).status).toBe("REVISION_REQUESTED");
  });
  it("perbaikan menggunakan surat baru; nomor lama utuh; hanya pemberi menerima hasil", async () => {
    const old = await get(response);
    const corrected = await draft(5, "IN", [], {
      dispositionId: id,
      subject: "Perbaikan hasil disposisi",
    });
    expect(
      (
        await rows("select app.can_read_letter_for($1,$2) yes", [
          actor(4),
          corrected,
        ])
      )[0].yes,
    ).toBe(false);
    await act(corrected, 5, "PREVIEW");
    await act(corrected, 5, "SUBMIT");
    await issue(corrected, 5, "disposition-correction");
    const l = await get(corrected);
    await run("select finalize_letter($1,$2,$3,false)", [
      actor(5),
      corrected,
      l.revision,
    ]);
    await move(5, "SUBMIT", "Tujuan sudah diperbaiki");
    const revision = (await disp()).revision;
    await expect(
      run("select disposition_workflow($1,'ACCEPT',$2,$3,'{}')", [
        actor(4),
        id,
        revision - 1,
      ]),
    ).rejects.toThrow(/berubah/);
    await move(4, "ACCEPT", "Hasil sudah sesuai");
    expect((await disp()).status).toBe("DONE");
    expect((await get(response)).official_number).toBe(old.official_number);
    await expect(move(5, "START")).rejects.toThrow(/kewenangan/);
    const events = await rows(
      "select action from audit_logs where entity_id=$1 and action like 'DISPOSITION_%'",
      [id],
    );
    expect(events.map((e) => e.action)).toContain("DISPOSITION_ACCEPT");
    expect(events.map((e) => e.action)).toContain("DISPOSITION_RETURN");
    expect(
      (
        await rows(
          "select id from notifications where disposition_id=$1 and recipient_id=$2",
          [id, actor(4)],
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it("RPC disposisi dan inti draft tidak dapat dijalankan langsung oleh klien", async () => {
    for (const fn of [
      "disposition_workflow(uuid,text,uuid,integer,jsonb)",
      "save_letter_draft_core(uuid,jsonb,jsonb)",
    ]) {
      expect(
        (
          await rows(
            "select has_function_privilege('authenticated',$1,'execute') yes",
            [fn],
          )
        )[0].yes,
      ).toBe(false);
      expect(
        (
          await rows("select has_function_privilege('anon',$1,'execute') yes", [
            fn,
          ])
        )[0].yes,
      ).toBe(false);
    }
  });
});

it("Senior Manager tetap berwenang mengesahkan tagihan ketika penugasannya di unit lain", async () => {
  await db.exec("begin");
  try {
    await run(
      "update user_assignments set unit_id=(select id from organizational_units where code='ACH') where profile_id=$1",
      [actor(3)],
    );
    const bank = (await rows("select id from master_bank limit 1"))[0].id;
    const id = await draft(6, "Tag", [3, 2], {
      billing: {
        bankId: bank,
        accountNumber: "UJI",
        accountHolder: "UJI",
        items: [
          { description: "A", amount: 1 },
          { description: "B", amount: 2 },
        ],
      },
    });
    expect((await get(id)).signer_ids).toEqual([actor(3), actor(2)]);
  } finally {
    await db.exec("rollback");
  }
});

it("riwayat pembatalan dapat dibaca tanpa rekursi RLS dan tetap dibatasi akun", async () => {
  await db.exec(
    "grant select on cancellation_requests,cancellation_authorizations to authenticated",
  );
  await run("select set_config('request.jwt.claim.sub',$1,false)", [actor(5)]);
  await db.exec("set role authenticated");
  try {
    expect(
      (await rows("select id from cancellation_requests")).length,
    ).toBeGreaterThan(0);
    expect(
      (await rows("select id from cancellation_authorizations")).length,
    ).toBeGreaterThan(0);
  } finally {
    await db.exec("reset role");
  }
  await run("select set_config('request.jwt.claim.sub',$1,false)", [actor(6)]);
  await db.exec("set role authenticated");
  try {
    expect((await rows("select id from cancellation_requests")).length).toBe(0);
    expect(
      (await rows("select id from cancellation_authorizations")).length,
    ).toBe(0);
  } finally {
    await db.exec("reset role");
  }
});

it("versi draft menyimpan format HTML secara eksplisit, teks lama tetap TEXT", async () => {
  const html = '<p style="text-align:right"><b>Isi berformat</b></p>';
  const id = await draft(5, "IN", [], { content: html, contentFormat: "HTML" });
  const v = (
    await rows(
      "select content_html,content_format from letter_versions where letter_id=$1",
      [id],
    )
  )[0];
  expect(v.content_format).toBe("HTML");
  expect(v.content_html).toBe(html);
  const old = await draft(5, "IN");
  expect(
    (
      await rows(
        "select content_format from letter_versions where letter_id=$1",
        [old],
      )
    )[0].content_format,
  ).toBe("TEXT");
});

describe.sequential('PR-01: event dan audit terikat transaksi alur sah', () => {
  it('aksi tanpa kewenangan tidak menghasilkan event atau audit palsu', async () => {
    const id = await draft(5, 'IN');
    const before = await rows('select (select count(*) from notifications) n, (select count(*) from audit_logs) a');
    await expect(act(id, 6, 'SUBMIT')).rejects.toThrow();
    expect(await rows('select (select count(*) from notifications) n, (select count(*) from audit_logs) a')).toEqual(before);
    expect((await get(id)).status).toBe('DRAFT');
  });
  it('gagal insert event membatalkan perubahan status dan audit, lalu retry sah berhasil', async () => {
    const id = await draft(5, 'IN');
    await act(id, 5, 'PREVIEW');
    const before = await rows('select (select count(*) from notifications) n, (select count(*) from audit_logs) a');
    await db.exec(`create function app.test_fail_notification() returns trigger language plpgsql as $$ begin raise exception 'Simulasi write event gagal'; end $$;
      create trigger test_fail_notification before insert on notifications for each row execute function app.test_fail_notification()`);
    try {
      await expect(act(id, 5, 'SUBMIT')).rejects.toThrow(/event gagal/);
      expect((await get(id)).status).toBe('DRAFT');
      expect(await rows('select (select count(*) from notifications) n, (select count(*) from audit_logs) a')).toEqual(before);
    } finally {
      await db.exec('drop trigger test_fail_notification on notifications; drop function app.test_fail_notification()');
    }
    await act(id, 5, 'SUBMIT');
    expect((await get(id)).status).toBe('READY_TO_ISSUE');
    expect((await rows('select recipient_id,event_type from notifications where letter_id=$1', [id]))).toEqual([{ recipient_id: actor(5), event_type: 'SUBMIT' }]);
    expect((await rows("select action from audit_logs where letter_id=$1 and action='SUBMIT'", [id]))).toHaveLength(1);
    await expect(act(id, 5, 'SUBMIT')).rejects.toThrow();
    expect((await rows("select id from notifications where letter_id=$1 and event_type='SUBMIT'", [id]))).toHaveLength(1);
  });
});
