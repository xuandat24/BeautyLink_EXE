import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.util.*;

/** Reads evidence produced by BackupAndVerify.ps1, verifies every dump hash, never restores production. */
class VerifiedBackupEvidence {
    static String require(java.sql.Connection c) throws Exception {
        String folder=System.getenv("VERIFIED_BACKUP_DIR");if(folder==null)throw new IllegalStateException("Verified current backup evidence required");
        long tables=((Number)RecoveryStore.query(c,"select count(*) as n from information_schema.tables where table_schema=database() and table_type='BASE TABLE'").getFirst().get("n")).longValue();
        return validate(Path.of(folder),c.getCatalog(),tables);
    }
    static String validate(Path folder,String database,long tables) throws Exception {
        var json=RecoveryStore.JSON;Path root=folder.toRealPath(),dump=root.resolve("dump").toRealPath();
        JsonNode proof=json.readTree(Files.readString(root.resolve("RESTORE_VERIFIED.json")).replace("\uFEFF","")),source=json.readTree(Files.readString(root.resolve("source-schema.json")).replace("\uFEFF",""));
        Instant completed=Instant.parse(proof.path("CompletedUtc").asText());
        if(!dump.startsWith(root)||!"isolated-local-docker".equals(proof.path("target").asText())||!"PASS".equals(proof.path("checksum").asText())||!"PASS".equals(proof.path("schema").asText())||!"PASS".equals(proof.path("ApplicationRead").asText())||proof.path("orphanRows").asLong(-1)!=0||proof.path("foreignKeysChecked").asLong()<=0||proof.path("tableCount").asLong()!=tables||!database.equals(source.path("schema").asText())||completed.isAfter(Instant.now().plusSeconds(60))||completed.isBefore(Instant.now().minus(Duration.ofHours(24))))throw new IllegalStateException("Current full backup/restore evidence is missing, stale or incompatible");
        var manifest=json.readTree(Files.readString(root.resolve("SHA256SUMS.json")).replace("\uFEFF",""));if(!manifest.isArray()||manifest.isEmpty())throw new IllegalStateException("Backup hash manifest missing");
        var names=new HashSet<String>();
        for(var file:manifest){String relative=file.path("File").asText().replace('\\','/');Path path=dump.resolve(relative).normalize().toRealPath();if(!path.startsWith(dump)||!Files.isRegularFile(path)||!names.add(relative)||Files.size(path)!=file.path("Length").asLong(-1))throw new IllegalStateException("Invalid backup path/length");
            MessageDigest digest=MessageDigest.getInstance("SHA-256");try(var in=new DigestInputStream(Files.newInputStream(path),digest)){in.transferTo(java.io.OutputStream.nullOutputStream());}
            if(!HexFormat.of().formatHex(digest.digest()).equalsIgnoreCase(file.path("SHA256").asText()))throw new IllegalStateException("Backup checksum mismatch");
        }
        try(var files=Files.walk(dump)){for(var path:files.filter(Files::isRegularFile).toList())if(!names.contains(dump.relativize(path).toString().replace('\\','/')))throw new IllegalStateException("Unlisted backup file");}
        if(!names.contains("@.done.json")||!names.contains("@.checksums.json"))throw new IllegalStateException("Incomplete MySQL backup");return completed.toString();
    }
}
