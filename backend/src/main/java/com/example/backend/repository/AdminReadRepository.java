package com.example.backend.repository;

import com.example.backend.service.AdminDashboardService.Range;
import com.example.backend.model.DomainEnums.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;
import java.util.*;

/** Read-only projections. Never join a booking to its many attempts for booking counts. */
@Repository
public class AdminReadRepository {
    @PersistenceContext private EntityManager em;
    public static final String COHORT = "b.createdAt >= :from and b.createdAt < :to and b.customer.role = :customer and (:demo = true or b.supplier.demoData = false)";
    public static final String PAID = "p.status = :paid and p.requiresManualReview = false and p.paidAt is not null and p.id = (select min(p2.id) from PaymentTransaction p2 where p2.booking = p.booking and p2.status = :paid)";
    public static final String PAYMENT_PERIOD = "p.paidAt >= :from and p.paidAt < :to and b.customer.role = :customer and (:demo = true or b.supplier.demoData = false)";

    public Query query(String hql, Range range) {
        Query query = em.createQuery(hql);
        if (hql.contains(":from")) query.setParameter("from", range.from());
        if (hql.contains(":to")) query.setParameter("to", range.to());
        if (hql.contains(":demo")) query.setParameter("demo", range.includeDemo());
        if (hql.contains(":customer")) query.setParameter("customer", Role.CUSTOMER);
        if (hql.contains(":paid")) query.setParameter("paid", PaymentTransactionStatus.PAID);
        if (hql.contains(":approval")) query.setParameter("approval", VerificationStatus.VERIFIED);
        if (hql.contains(":active")) query.setParameter("active", AccountStatus.ACTIVE);
        if (hql.contains(":completed")) query.setParameter("completed", BookingStatus.COMPLETED);
        if (hql.contains(":cancelled")) query.setParameter("cancelled", BookingStatus.CANCELLED);
        return query;
    }
    public long count(String hql, Range range) { return ((Number) query(hql, range).getSingleResult()).longValue(); }
    @SuppressWarnings("unchecked")
    public List<Object[]> rows(String hql, Range range, int limit) {
        return query(hql, range).setMaxResults(limit).getResultList();
    }
}
