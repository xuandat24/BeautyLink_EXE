package com.example.backend;

import org.junit.jupiter.api.Test;
import org.springframework.context.support.GenericApplicationContext;
import javax.sql.DataSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PresentationIsolationTest {
    @Test void prodProfileIsRejectedBeforeLookingUpAnyDatabase() {
        try (var context = new GenericApplicationContext()) {
            context.getEnvironment().setActiveProfiles("presentation", "prod"); context.refresh();
            assertThrows(IllegalStateException.class, () -> PresentationDataset.requireIsolation(context));
        }
    }
    @Test void nonMemoryDatabaseIsRejectedWithoutExecutingAnyStatement() throws Exception {
        try (var context = new GenericApplicationContext()) {
            context.getEnvironment().setActiveProfiles("presentation");
            var source = mock(DataSource.class); var connection = mock(java.sql.Connection.class); var metadata = mock(java.sql.DatabaseMetaData.class);
            when(source.getConnection()).thenReturn(connection); when(connection.getMetaData()).thenReturn(metadata);
            when(metadata.getURL()).thenReturn("jdbc:mysql://127.0.0.1/not-allowed");
            context.registerBean(DataSource.class, () -> source); context.refresh();
            assertThrows(IllegalStateException.class, () -> PresentationDataset.requireIsolation(context));
            verify(connection, never()).createStatement(); verify(connection, never()).prepareStatement(anyString());
        }
    }
}
