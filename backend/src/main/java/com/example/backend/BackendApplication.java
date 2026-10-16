package com.example.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {
    public static void main(String[] args) {
        if (args.length > 0 && "seed-customers".equals(args[0])) {
            com.example.customerseed.CustomerSeedApplication.run(
                    java.util.Arrays.copyOfRange(args, 1, args.length));
            return;
        }
        SpringApplication.run(BackendApplication.class, args);
    }
}
