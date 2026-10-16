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

/** Run with Java 21 source-file mode. Writes secrets only to the named local file. */
class GenerateCredentials {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghjkmnpqrstuvwxyz";
    private static final String DIGIT = "23456789";
    private static final String SYMBOL = "!@#$%*_-";
    private static final String ALL = UPPER + LOWER + DIGIT + SYMBOL;

    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Usage: java GenerateCredentials.java <manifest.psv> <new-private-credentials.psv>");
        Path manifest = Path.of(args[0]);
        Path output = Path.of(args[1]);
        Path privateDir = output.getParent();
        if (privateDir == null || !privateDir.getFileName().toString().equals("private")
                || Files.isSymbolicLink(privateDir)) {
            throw new IllegalArgumentException("Credential output must be inside a non-symlink private/ directory");
        }
        List<String> source = Files.readAllLines(manifest, StandardCharsets.UTF_8);
        if (source.size() != 61 || !source.getFirst().equals("index|fullName|phone|email|gender|dateOfBirth|city")) {
            throw new IllegalArgumentException("Expected the 60-account customer manifest");
        }
        StringBuilder content = new StringBuilder("index|email|password\n");
        Set<String> passwords = new HashSet<>();
        for (int i = 1; i <= 60; i++) {
            String[] fields = source.get(i).split("\\|", -1);
            String email = String.format("bl-customer-%03d@example.com", i);
            if (fields.length != 7 || !fields[0].equals(Integer.toString(i)) || !fields[3].equals(email)) {
                throw new IllegalArgumentException("Invalid synthetic identity at row " + i);
            }
            String secret;
            do { secret = password(); } while (!passwords.add(secret));
            content.append(i).append('|').append(email).append('|').append(secret).append('\n');
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
        System.out.println("Generated 60 unique credentials in the requested local file; passwords were not printed.");
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
