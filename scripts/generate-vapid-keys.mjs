import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Tambahkan nilai berikut ke environment production:");
console.log("");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@bmbi.my.id");
console.log("");
console.log(
  "Jangan membagikan VAPID_PRIVATE_KEY. Kunci publik memang dikirim ke browser.",
);
