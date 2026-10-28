declare const db: any;

// ruleid: no-raw-sql
db.$queryRawUnsafe('select 1');
// ruleid: no-raw-sql
db.$executeRawUnsafe('delete from x');
// ok: no-raw-sql
db.user.findMany();
