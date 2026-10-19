package com.example.customerseed;

import com.example.backend.model.DomainEnums.Gender;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** A deliberately fixed, synthetic identity namespace. No real contact data belongs here. */
public final class CustomerSeedManifest {
    private static final String HEADER = "index|fullName|phone|email|gender|dateOfBirth|city";
    private static final String CREDENTIAL_HEADER = "index|email|password";
    public static final int SIZE = 80;
    public static final String EMAIL_PREFIX = "bl-customer-";
    public static final String EMAIL_DOMAIN = "@seed.beautylink.test";

    private CustomerSeedManifest() {}

    public record Profile(int index, String fullName, String phone, String email,
                          Gender gender, LocalDate dateOfBirth, String city) {}
    public record Credential(int index, String email, String password) {}

    public static List<Profile> profiles(Path file) throws IOException {
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        if (lines.size() != SIZE + 1 || !HEADER.equals(lines.getFirst())) {
            throw new IllegalArgumentException("Customer manifest must contain exactly 80 profiles and the expected header");
        }
        List<Profile> profiles = new ArrayList<>(SIZE);
        Set<String> names = new HashSet<>();
        Set<String> phones = new HashSet<>();
        Set<String> emails = new HashSet<>();
        for (int i = 1; i <= SIZE; i++) {
            String[] fields = lines.get(i).split("\\|", -1);
            if (fields.length != 7 || !Integer.toString(i).equals(fields[0])) {
                throw new IllegalArgumentException("Malformed customer manifest row " + i);
            }
            String expectedCity = i <= 30 || i >= 61 && i <= 70 ? "Hà Nội" : "Thành phố Hồ Chí Minh";
            LocalDate birthDate;
            Gender gender;
            try {
                birthDate = LocalDate.parse(fields[5]);
                gender = Gender.valueOf(fields[4]);
            } catch (RuntimeException ex) {
                throw new IllegalArgumentException("Invalid gender or birth date in customer manifest row " + i, ex);
            }
            if (!fields[1].matches("[\\p{L}]+(?: [\\p{L}]+)+")
                    || fields[1].length() > 120 || !names.add(fields[1])
                    || !fields[2].matches("^(032|056|070|081|090)[0-9]{7}$") || !phones.add(fields[2])
                    || !managedEmail(fields[3], i) || !emails.add(fields[3])
                    || !expectedCity.equals(fields[6])
                    || birthDate.isBefore(LocalDate.of(1900, 1, 1))
                    || birthDate.isAfter(LocalDate.now().minusYears(18))) {
                throw new IllegalArgumentException("Invalid synthetic customer identity in manifest row " + i);
            }
            profiles.add(new Profile(i, fields[1], fields[2], fields[3], gender, birthDate, fields[6]));
        }
        return List.copyOf(profiles);
    }

    public static List<Credential> credentials(Path file) throws IOException {
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        if (lines.size() != SIZE + 1 || !CREDENTIAL_HEADER.equals(lines.getFirst())) {
            throw new IllegalArgumentException("Credential file must contain exactly 80 entries and the expected header");
        }
        List<Credential> credentials = new ArrayList<>(SIZE);
        Set<String> passwords = new HashSet<>();
        for (int i = 1; i <= SIZE; i++) {
            String[] fields = lines.get(i).split("\\|", -1);
            if (fields.length != 3 || !Integer.toString(i).equals(fields[0])
                    || !(managedEmail(fields[1], i) || i <= 60 && legacyEmail(i).equals(fields[1]))
                    || fields[2].length() < 20
                    || fields[2].length() > 72
                    || !fields[2].matches("(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%*_-])[A-Za-z0-9!@#$%*_-]+")
                    || !passwords.add(fields[2])) {
                throw new IllegalArgumentException("Invalid credential row " + i);
            }
            credentials.add(new Credential(i, fields[1], fields[2]));
        }
        return List.copyOf(credentials);
    }

    public static String legacyEmail(int index) {
        return EMAIL_PREFIX + String.format("%03d", index) + "@example.com";
    }
    public static String legacyPhone(int index) { return "039000" + String.format("%04d", index); }
    public static boolean managedEmail(String email, int index) {
        return email.matches("[a-z]+(?:\\.[a-z]+)*\\." + String.format("%03d", index)
                + "\\.[0-9]{6}@seed\\.beautylink\\.test");
    }
}
