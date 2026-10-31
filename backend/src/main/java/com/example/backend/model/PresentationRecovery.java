package com.example.backend.model;

import jakarta.persistence.*;

/** Historical presentation records only; not accounts, appointments or payment transactions. */
@Entity
@Table(name = "presentation_recovery")
public class PresentationRecovery {
    @Id @Column(length = 64) private String id;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT", updatable = false) private String payload;
    public String getPayload() { return payload; }
}
