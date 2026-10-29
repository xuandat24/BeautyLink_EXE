package com.example.backend.community;
public final class CommunityTypes {
 private CommunityTypes() {}
 public enum Category { GENERAL, QUESTIONS, NAIL_HAIR, SKINCARE, WELLNESS, PROFESSIONAL, RECOMMENDATIONS }
 public enum Visibility { PUBLISHED, HIDDEN, DELETED }
 public enum Identity { ACCOUNT, SALON, PRACTITIONER }
 public enum Action { HIDE, RESTORE, REMOVE, DISMISS_REPORT, RESTRICT_AUTHOR, ALLOW_AUTHOR }
}
