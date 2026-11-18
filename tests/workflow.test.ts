import { describe, it, expect } from "vitest";
import {
  jakartaDate,
  validateLetterDate,
  validateArea,
  workflowLabel,
} from "../src/domain/workflow";
describe("REV-01 tanggal", () => {
  it("menggunakan tanggal Jakarta di batas hari", () =>
    expect(jakartaDate(new Date("2026-11-17T18:00:00Z"))).toBe("2026-11-18"));
  it("menolak tanggal mustahil", () =>
    expect(() => validateLetterDate("2026-02-30", true, "koreksi")).toThrow());
  it("menolak staf memundurkan tanggal meskipun mengisi alasan", () =>
    expect(() =>
      validateLetterDate("2026-11-16", false, "koreksi", "2026-11-18"),
    ).toThrow());
  it("mensyaratkan alasan pejabat dan menerima tanggal mundur sah", () => {
    expect(() =>
      validateLetterDate("2026-11-16", true, "", "2026-11-18"),
    ).toThrow();
    expect(() =>
      validateLetterDate(
        "2026-11-16",
        true,
        "Koreksi tanggal rapat",
        "2026-11-18",
      ),
    ).not.toThrow();
  });
});
describe("REV-03 area tervalidasi", () => {
  const pages = [{ width: 595, height: 842 }];
  it("menolak koordinat di luar halaman dan halaman tak ada", () => {
    expect(() =>
      validateArea({ page: 1, x: 590, y: 0, width: 100, height: 50 }, pages),
    ).toThrow();
    expect(() =>
      validateArea({ page: 2, x: 0, y: 0, width: 100, height: 50 }, pages),
    ).toThrow();
  });
  it("menerima area di dalam halaman", () =>
    expect(() =>
      validateArea({ page: 1, x: 350, y: 600, width: 120, height: 50 }, pages),
    ).not.toThrow());
});
it("memisahkan bernomor, bertanda tangan, dan selesai", () => {
  expect(
    workflowLabel({ status: "NUMBERED", signature_status: "WAITING" }),
  ).toBe("Menunggu TTD");
  expect(
    workflowLabel({ status: "NUMBERED", signature_status: "UPLOADED" }),
  ).toBe("Menunggu Finalisasi");
  expect(
    workflowLabel({ status: "NUMBERED", finalized_at: "2026-11-18" }),
  ).toBe("Dokumen final");
});

it('surat final yang dibatalkan tetap ditampilkan Dibatalkan',()=>{expect(workflowLabel({status:'CANCELLED',finalized_at:'2026-11-18'})).toBe('Dibatalkan');});
