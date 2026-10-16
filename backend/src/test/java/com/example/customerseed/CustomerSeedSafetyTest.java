package com.example.customerseed;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CustomerSeedSafetyTest {
    @Test
    void remoteAndProductionTargetsRequireSeparateExplicitOptIns() {
        assertThatThrownBy(() -> CustomerSeedApplication.checkTarget(
                "db.example.net", false, false, "", true, false, false))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> CustomerSeedApplication.checkTarget(
                "db.example.net", false, true, "another.example.net", true, false, false))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> CustomerSeedApplication.checkTarget(
                "db.example.net", false, true, "db.example.net", true, true, false))
                .isInstanceOf(IllegalStateException.class);
        assertThatCode(() -> CustomerSeedApplication.checkTarget(
                "127.0.0.1", true, false, "", true, false, false))
                .doesNotThrowAnyException();
    }
}
