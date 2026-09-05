# Kitaab

Shared expense books — name a book, invite people, keep the ledger, the chat, and the reckoning.

Live: [https://itrip.ipds.cloud](https://itrip.ipds.cloud)

## Coolify (Hostinger VPS)

1. In Coolify, **New Resource → Docker Compose**.
2. Connect this GitHub repo (`iamkarampalsingh/kitaab`), branch `main`, compose file `docker-compose.yml`.
3. On the **app** service, set the domain to `itrip.ipds.cloud` (HTTPS on).
4. Deploy. Coolify builds the image, starts Postgres, and proxies port 3000.

DNS for `itrip.ipds.cloud` should already point at the VPS.

Sign-in on this host is **email + password**. Create an account from the login page.

## Local

```sh
npm install
npm run dev
```
