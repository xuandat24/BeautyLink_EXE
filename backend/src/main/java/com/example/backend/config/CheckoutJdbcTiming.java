package com.example.backend.config;

import com.example.backend.service.CheckoutTrace;
import org.hibernate.BaseSessionEventListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;

/** Numeric JDBC execution measurements; no SQL text, bind values or query results. */
public class CheckoutJdbcTiming extends BaseSessionEventListener {
    @Override public void jdbcExecuteStatementStart() { CheckoutTrace.sqlStart(); }
    @Override public void jdbcExecuteStatementEnd() { CheckoutTrace.sqlEnd(); }
    @Override public void jdbcExecuteBatchStart() { CheckoutTrace.sqlStart(); }
    @Override public void jdbcExecuteBatchEnd() { CheckoutTrace.sqlEnd(); }
    @Configuration(proxyBeanMethods = false)
    static class Registration {
        @Bean HibernatePropertiesCustomizer checkoutJdbcTiming() {
            return properties -> properties.put("hibernate.session.events.auto", CheckoutJdbcTiming.class.getName());
        }
    }
}
