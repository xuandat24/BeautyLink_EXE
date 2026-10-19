// Executed by the installed MySQL Shell. Never prints rows or credentials.
var mode = os.getenv('BL_BACKUP_MODE');
var schema = os.getenv('BL_BACKUP_SCHEMA');
var host = os.getenv('BL_BACKUP_HOST');
var dump = os.getenv('BL_BACKUP_DUMP');
function requireSafe(ok, message) { if (!ok) throw new Error(message); }
requireSafe(/^[a-zA-Z0-9_]+$/.test(schema), 'Invalid schema');
requireSafe(mode === 'dump' || mode === 'restore', 'Invalid mode');
if (mode === 'restore') requireSafe(host === '127.0.0.1', 'Restore is restricted to loopback');
shell.connect({scheme: 'mysql', host: host, port: Number(os.getenv('BL_BACKUP_PORT')),
    user: os.getenv('BL_BACKUP_USER'), password: os.getenv('BL_BACKUP_PASSWORD'), 'ssl-mode': 'REQUIRED'});
var backupSession = shell.getSession();
function rows(sql, args) {
    var result = backupSession.runSql(sql, args || [schema]);
    var names = result.getColumns().map(c => c.getColumnName());
    return result.fetchAll().map(r => names.map(name => r.getField(name)));
}
function count(sql, args) { return Number(backupSession.runSql(sql, args || [schema]).fetchOne()[0]); }
function qi(name) { return '`' + name.replace(/`/g, '``') + '`'; }
function structure() {
    return {
        tables: rows('SELECT TABLE_NAME,TABLE_TYPE,ENGINE,TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME'),
        columns: rows('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,ORDINAL_POSITION'),
        keys: rows('SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION'),
        indexes: rows('SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART,INDEX_TYPE,IS_VISIBLE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX'),
        routines: rows('SELECT ROUTINE_NAME,ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? ORDER BY ROUTINE_NAME'),
        events: rows('SELECT EVENT_NAME,STATUS FROM information_schema.EVENTS WHERE EVENT_SCHEMA=? ORDER BY EVENT_NAME'),
        triggers: rows('SELECT TRIGGER_NAME,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_TIMING FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? ORDER BY TRIGGER_NAME')
    };
}
if (mode === 'dump') {
    requireSafe(count('SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?') === 1, 'Source schema missing');
    var before = structure();
    requireSafe(before.tables.length > 0 && before.tables.every(t => t[1] !== 'BASE TABLE' || t[2] === 'InnoDB'), 'Consistent backup requires InnoDB tables');
    var version = backupSession.runSql('SELECT VERSION()').fetchOne()[0];
    util.dumpSchemas([schema], dump, {consistent: true, skipConsistencyChecks: false, checksum: true,
        threads: 2, showProgress: false, compression: 'zstd', events: true, routines: true, triggers: true});
    requireSafe(JSON.stringify(before) === JSON.stringify(structure()), 'Schema changed during backup');
    print('\nBL_BACKUP_RESULT=' + JSON.stringify({serverVersion: version, schema: schema, structure: before}) + '\n');
} else {
    requireSafe(count('SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?') === 0, 'Restore target must be a new empty instance');
    requireSafe(backupSession.runSql('SELECT @@event_scheduler').fetchOne()[0] !== 'ON', 'Restore event scheduler must be disabled');
    var source = JSON.parse(os.loadTextFile(os.getenv('BL_BACKUP_SOURCE_REPORT')).replace(/^\uFEFF/, ''));
    requireSafe(backupSession.runSql('SELECT VERSION()').fetchOne()[0] === source.serverVersion, 'Restore server version must match backup source');
    util.loadDump(dump, {checksum: true, threads: 2, showProgress: false, progressFile: '', loadUsers: false});
    var actual = structure();
    requireSafe(JSON.stringify(source.structure) === JSON.stringify(actual), 'Restored schema differs from source');
    var rowCounts = {};
    actual.tables.filter(t => t[1] === 'BASE TABLE').forEach(t => {
        rowCounts[t[0]] = count('SELECT COUNT(*) FROM ' + qi(schema) + '.' + qi(t[0]), []);
    });
    ['user_accounts','suppliers','practitioners','availability_rules','practitioner_service_assignments',
        'bookings','payment_transactions','booking_reviews'].forEach(t => requireSafe(t in rowCounts, 'Required table missing'));
    var fk = {};
    actual.keys.filter(k => k[3] !== null).forEach(k => {
        var id = k[0] + ':' + k[1];
        if (!fk[id]) fk[id] = [];
        fk[id].push(k);
    });
    Object.keys(fk).forEach(id => {
        var key = fk[id], first = key[0];
        var join = key.map(k => 'c.' + qi(k[2]) + '=p.' + qi(k[4])).join(' AND ');
        var present = key.map(k => 'c.' + qi(k[2]) + ' IS NOT NULL').join(' AND ');
        var orphan = count('SELECT COUNT(*) FROM ' + qi(schema) + '.' + qi(first[0]) + ' c LEFT JOIN '
            + qi(schema) + '.' + qi(first[3]) + ' p ON ' + join + ' WHERE ' + present
            + ' AND p.' + qi(first[4]) + ' IS NULL', []);
        requireSafe(orphan === 0, 'Foreign-key orphan detected');
    });
    requireSafe(Object.keys(fk).length > 0, 'No foreign keys verified');
    var customers = count('SELECT COUNT(*) FROM ' + qi(schema) + '.user_accounts WHERE role=?', ['CUSTOMER']);
    print('\nBL_RESTORE_RESULT=' + JSON.stringify({checksum: 'PASS', schema: 'PASS',
        foreignKeysChecked: Object.keys(fk).length, orphanRows: 0, tableCount: actual.tables.length,
        rowCounts: rowCounts, customers: customers, target: 'isolated-local-docker'}) + '\n');
}
backupSession.close();
