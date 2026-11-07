export type PwaPlatform = "ios" | "android" | "other";

export interface PwaEnvironment {
  platform: PwaPlatform;
  standalone: boolean;
  inAppBrowser: boolean;
  safari: boolean;
  /** Versi iOS hanya dipakai untuk batas dukungan yang diketahui. */
  iosVersion: { major: number; minor: number } | null;
}

export interface RelatedPwaApplication {
  platform: string;
  id?: string;
  url?: string;
  version?: string;
}

export function detectPwaEnvironment({
  userAgent,
  maxTouchPoints = 0,
  standalone = false,
}: {
  userAgent: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}): PwaEnvironment {
  // Safari pada iPad dapat memakai user agent desktop (Macintosh).
  const ios =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const platform = ios
    ? "ios"
    : /Android/i.test(userAgent)
      ? "android"
      : "other";
  const version = ios ? /(?:CPU(?: iPhone)? OS|iPhone OS) (\d+)[_.](\d+)/i.exec(userAgent) : null;
  const safari =
    ios &&
    /Version\/[\d.]+.*Safari\//i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/i.test(userAgent);
  const inAppBrowser =
    /FBAN|FBAV|Instagram|MicroMessenger|\bLine\/|Twitter|TikTok|WhatsApp/i.test(userAgent) ||
    /; wv\)|\bwv\b/i.test(userAgent) ||
    (ios && !safari && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/i.test(userAgent));

  return {
    platform,
    standalone,
    safari,
    // A standalone web app need not include Safari in its user agent.
    inAppBrowser: !standalone && inAppBrowser,
    iosVersion: version
      ? { major: Number(version[1]), minor: Number(version[2]) }
      : null,
  };
}

export function isPwaStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function readPwaEnvironment(): PwaEnvironment {
  if (typeof window === "undefined") {
    return detectPwaEnvironment({ userAgent: "" });
  }
  return detectPwaEnvironment({
    userAgent: window.navigator.userAgent,
    maxTouchPoints: window.navigator.maxTouchPoints,
    standalone: isPwaStandalone(),
  });
}

export function iosSupportsWebPush(environment: PwaEnvironment) {
  const version = environment.iosVersion;
  // User agents may omit/freeze the OS version; feature detection is decisive
  // once the app is opened from the Home Screen.
  return (
    !version ||
    version.major > 16 ||
    (version.major === 16 && version.minor >= 4)
  );
}

/** Do not treat unrelated apps, or an old localStorage marker, as proof. */
export function hasRelatedPwa(
  applications: RelatedPwaApplication[],
  origin: string,
) {
  const manifest = new URL("/manifest.webmanifest", origin).href;
  return applications.some((application) => {
    if (application.platform !== "webapp" || !application.url) return false;
    try {
      return new URL(application.url, origin).href === manifest;
    } catch {
      return false;
    }
  });
}

export function pwaInstallGuide(environment: PwaEnvironment | null) {
  if (environment?.platform === "ios") {
    return {
      description: "Pemasangan di iPhone/iPad dilakukan lewat menu Bagikan di Safari, bukan otomatis dari tombol situs.",
      steps: [
        ...(environment.inAppBrowser
          ? ["Buka menu browser dalam aplikasi ini, lalu pilih Buka di Safari. Jika tidak tersedia, salin alamat SIBUMA dan buka di Safari."]
          : !environment.safari
            ? ["Buka alamat SIBUMA melalui Safari."]
            : []),
        "Tekan Bagikan (ikon kotak dengan panah ke atas). Pada sebagian versi iOS, buka menu lainnya terlebih dahulu.",
        "Pilih Tambahkan ke Layar Utama. Jika tidak terlihat, cari melalui Edit Tindakan di menu Bagikan.",
        "Jika tersedia, aktifkan Buka sebagai App Web, lalu tekan Tambah.",
        "Buka SIBUMA dari ikon di Layar Utama, lalu masuk jika diminta.",
      ],
      note: "Notifikasi memerlukan iOS/iPadOS 16.4 atau lebih baru. Setelah terpasang, buka SIBUMA dari ikonnya dan aktifkan notifikasi di Profil. Data pekerjaan tetap memerlukan internet.",
    };
  }

  if (environment?.platform === "android") {
    return {
      description: "Tambahkan SIBUMA ke layar utama melalui browser yang mendukung pemasangan aplikasi.",
      steps: [
        ...(environment.inAppBrowser
          ? ["Buka menu browser dalam aplikasi ini, lalu pilih Buka di Chrome. Jika tidak tersedia, salin alamat SIBUMA dan buka di Chrome."]
          : []),
        "Buka menu ⋮ di Chrome atau menu browser yang kamu gunakan.",
        "Pilih Instal aplikasi atau Tambahkan ke Layar Utama, lalu konfirmasi pemasangan.",
        "Buka SIBUMA dari ikon di layar utama.",
      ],
      note: "Jika opsi pemasangan belum tersedia, gunakan Chrome terbaru dan alamat HTTPS SIBUMA. Data pekerjaan tetap memerlukan internet.",
    };
  }

  return {
    description: "Buka SIBUMA langsung dari layar utama atau daftar aplikasi perangkat.",
    steps: [
      "Buka menu browser yang kamu gunakan.",
      "Pilih Instal aplikasi jika tersedia, lalu konfirmasi pemasangan.",
      "Buka SIBUMA dari ikon aplikasi yang ditambahkan.",
    ],
    note: "Di iPhone/iPad, gunakan Safari → Bagikan → Tambahkan ke Layar Utama. Di Android, gunakan menu pemasangan di Chrome. Data pekerjaan tetap memerlukan internet.",
  };
}
