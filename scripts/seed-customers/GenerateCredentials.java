import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.io.IOException;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.AclEntry;
import java.nio.file.attribute.AclEntryPermission;
import java.nio.file.attribute.AclEntryType;
import java.nio.file.attribute.AclFileAttributeView;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.HashMap;

/** Run with Java 21 source-file mode. Writes secrets only to the named local file. */
class GenerateCredentials {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghjkmnpqrstuvwxyz";
    private static final String DIGIT = "23456789";
    private static final String SYMBOL = "!@#$%*_-";
    private static final String ALL = UPPER + LOWER + DIGIT + SYMBOL;

    public static void main(String[] args) throws Exception {
        if (args.length < 2 || args.length > 3) throw new IllegalArgumentException("Usage: java GenerateCredentials.java <manifest.psv> <new-private-credentials.psv> [existing-credentials.psv]");
        Path manifest = Path.of(args[0]);
        Path output = Path.of(args[1]);
        Path privateDir = output.getParent();
        if (privateDir == null || !privateDir.getFileName().toString().equals("private")
                || Files.isSymbolicLink(privateDir)) {
            throw new IllegalArgumentException("Credential output must be inside a non-symlink private/ directory");
        }
        List<String> source = Files.readAllLines(manifest, StandardCharsets.UTF_8);
        if (source.size() != 81 || !source.getFirst().equals("index|fullName|phone|email|gender|dateOfBirth|city")) {
            throw new IllegalArgumentException("Expected the 80-account customer manifest");
        }
        Map<Integer, String> preserved = new HashMap<>();
        if (args.length == 3) {
            var previous = Files.readAllLines(Path.of(args[2]), StandardCharsets.UTF_8);
            if ((previous.size() != 61 && previous.size() != 81)
                    || !previous.getFirst().equals("index|email|password"))
                throw new IllegalArgumentException("Expected the existing 60 or 80 credential entries");
            for (int i = 1; i < previous.size(); i++) {
                var f = previous.get(i).split("\\|", -1);
                if (f.length != 3 || !f[0].equals(Integer.toString(i))
                        || !(f[1].equals(String.format("bl-customer-%03d@example.com", i))
                             || f[1].matches("[a-z.]+\\." + String.format("%03d", i) + "\\.[0-9]{6}@seed\\.beautylink\\.test"))
                        || f[2].length() < 20 || f[2].length() > 72)
                    throw new IllegalArgumentException("Invalid previous credential row " + i);
                preserved.put(i, f[2]);
            }
        }
        StringBuilder content = new StringBuilder("index|email|password\n");
        Set<String> passwords = new HashSet<>(preserved.values());
        if (passwords.size() != preserved.size()) throw new IllegalArgumentException("Duplicate previous passwords");
        for (int i = 1; i <= 80; i++) {
            String[] fields = source.get(i).split("\\|", -1);
            if (fields.length != 7 || !fields[0].equals(Integer.toString(i))
                    || !fields[3].matches("[a-z.]+\\." + String.format("%03d", i) + "\\.[0-9]{6}@seed\\.beautylink\\.test")) {
                throw new IllegalArgumentException("Invalid synthetic identity at row " + i);
            }
            String secret = preserved.get(i);
            if (secret == null) do { secret = password(); } while (!passwords.add(secret));
            content.append(i).append('|').append(fields[3]).append('|').append(secret).append('\n');
        }
        Files.createDirectories(privateDir);
        restrict(privateDir, true);
        Files.createFile(output);
        try {
            restrict(output, false);
            Files.writeString(output, content, StandardCharsets.UTF_8, StandardOpenOption.WRITE);
        } catch (Exception ex) {
            Files.deleteIfExists(output);
            throw ex;
        }
        System.out.printf("Credentials: total=80 preserved=%d generated=%d; passwords were not printed.%n",
                preserved.size(), 80 - preserved.size());
    }

    private static void restrict(Path path, boolean directory) throws IOException {
        if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
            Set<PosixFilePermission> permissions = directory
                    ? Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE)
                    : Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(path, permissions);
            return;
        }
        AclFileAttributeView acl = Files.getFileAttributeView(path, AclFileAttributeView.class);
        if (acl == null) throw new IllegalStateException("Cannot restrict credential path permissions");
        acl.setAcl(List.of(AclEntry.newBuilder().setType(AclEntryType.ALLOW)
                .setPrincipal(acl.getOwner())
                .setPermissions(EnumSet.allOf(AclEntryPermission.class)).build()));
    }

    private static String password() {
        List<Character> chars = new ArrayList<>();
        for (String group : List.of(UPPER, LOWER, DIGIT, SYMBOL)) chars.add(group.charAt(RANDOM.nextInt(group.length())));
        for (int i = chars.size(); i < 28; i++) chars.add(ALL.charAt(RANDOM.nextInt(ALL.length())));
        Collections.shuffle(chars, RANDOM);
        StringBuilder result = new StringBuilder(chars.size());
        chars.forEach(result::append);
        return result.toString();
    }
}
