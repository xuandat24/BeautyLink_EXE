package com.example.backend.service;

import java.util.*;
import java.util.function.Supplier;

/** Request-scoped numeric timings only. Never record payloads, URLs, identities or instructions. */
public final class CheckoutTrace {
    private static final ThreadLocal<Sample> CURRENT = new ThreadLocal<>();
    public static final class Sample {
        public final String id = UUID.randomUUID().toString();
        final long started = System.nanoTime();
        final Map<String, Double> timings = new LinkedHashMap<>();
        int statements;
        long jdbcStarted;
        public int sqlCount() { return statements; }
        public String header() {
            var values = new ArrayList<String>();
            timings.forEach((name, ms) -> values.add(name + ";dur=" + String.format(Locale.ROOT, "%.3f", ms)));

            return String.join(", ", values);
        }
    }
    public static Sample start() { var sample = new Sample(); CURRENT.set(sample); return sample; }
    public static void finish() { var s = CURRENT.get(); if (s != null) add("total", System.nanoTime() - s.started); }
    public static void clear() { CURRENT.remove(); }
    public static void enterService() { var s = CURRENT.get(); if (s != null && !s.timings.containsKey("pre_service")) add("pre_service", System.nanoTime() - s.started); }
    public static <T> T measure(String stage, Supplier<T> action) {
        long start = System.nanoTime(); try { return action.get(); } finally { add(stage, System.nanoTime() - start); }
    }
    private static void add(String stage, long ns) { var s = CURRENT.get(); if (s != null) s.timings.merge(stage, ns / 1_000_000d, Double::sum); }
    public static void sqlStart() { var s = CURRENT.get(); if (s != null) s.jdbcStarted = System.nanoTime(); }
    public static void sqlEnd() { var s = CURRENT.get(); if (s != null && s.jdbcStarted != 0) { s.statements++; add("jdbc", System.nanoTime() - s.jdbcStarted); s.jdbcStarted = 0; } }
    private CheckoutTrace() {}
}
