package com.example.backend;

import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Disposable local presentation server; no external payment gateway, secrets or persistent DB. */
public class PresentationServer {
    public static void main(String[] args) {
        var context = new SpringApplicationBuilder(BackendApplication.class).profiles("test", "presentation").run(
                "--spring.config.import=", "--server.address=127.0.0.1", "--server.port=8080",
                "--spring.datasource.url=jdbc:h2:mem:beautylink-presentation;MODE=MySQL;DB_CLOSE_DELAY=-1",
                "--spring.datasource.driver-class-name=org.h2.Driver", "--spring.datasource.username=sa", "--spring.datasource.password=",
                "--spring.jpa.hibernate.ddl-auto=create-drop", "--app.demo-data.enabled=false", "--app.partner-catalog.enabled=false",
                "--debug=false", "--logging.level.org.springframework.boot=INFO",
                "--app.payos.client-id=", "--app.payos.api-key=", "--app.payos.checksum-key=", "--app.payos.webhook-url=",
                "--app.otp.resend.api-key=", "--app.booking-email.enabled=false", "--app.cloudinary.enabled=false",
                "--app.cors.allowed-origins=http://localhost:5173,http://127.0.0.1:5173");
        new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).executeWithoutResult(status -> {
            try { PresentationDataset.catalog(context); } catch (Exception error) { throw new IllegalStateException(error); }
            var result = PresentationDataset.apply(context);
            PresentationDataset.otherStatuses(context);
            System.out.println("PRESENTATION_RECONCILIATION " + result);
        });
        System.out.println("PRESENTATION_READY");
    }
}
