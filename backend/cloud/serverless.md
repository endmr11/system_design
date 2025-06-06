# Serverless ve FaaS (Function as a Service)

## Giriş

Serverless computing, geliştiricilerin sunucu yönetimi konusunda endişe duymadan kod yazmasına olanak tanıyan bir bulut computing modelidir. Function as a Service (FaaS), serverless computing'in bir alt kümesidir ve belirli olaylar tarafından tetiklenen kısa süreli fonksiyonları çalıştırmaya odaklanır.

## Serverless Mimarisi Temelleri

### Ana Serverless Bileşenleri

1. **Functions**: Küçük, tek amaçlı kod parçaları
2. **Event Sources**: Fonksiyonları tetikleyen olaylar
3. **Runtime**: Fonksiyonların çalıştığı ortam
4. **API Gateway**: HTTP isteklerini fonksiyonlara yönlendiren servis

## AWS Lambda Implementation

### Lambda Function Örneği (Java)

```java
// UserService.java
package com.mycompany.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.util.*;

public class UserService implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    
    private final DynamoDbClient dynamoDbClient;
    private final ObjectMapper objectMapper;
    private final String tableName = System.getenv("USERS_TABLE");
    
    public UserService() {
        this.dynamoDbClient = DynamoDbClient.builder().build();
        this.objectMapper = new ObjectMapper();
    }
    
    @Override
    public APIGatewayProxyResponseEvent handleRequest(
            APIGatewayProxyRequestEvent request, 
            Context context) {
        
        try {
            String httpMethod = request.getHttpMethod();
            String path = request.getPath();
            
            switch (httpMethod) {
                case "GET":
                    return handleGetRequest(request);
                case "POST":
                    return handlePostRequest(request);
                case "PUT":
                    return handlePutRequest(request);
                case "DELETE":
                    return handleDeleteRequest(request);
                default:
                    return createResponse(405, "Method Not Allowed");
            }
        } catch (Exception e) {
            context.getLogger().log("Error: " + e.getMessage());
            return createResponse(500, "Internal Server Error");
        }
    }
    
    private APIGatewayProxyResponseEvent handleGetRequest(APIGatewayProxyRequestEvent request) {
        try {
            Map<String, String> pathParameters = request.getPathParameters();
            
            if (pathParameters != null && pathParameters.containsKey("id")) {
                // Get single user
                String userId = pathParameters.get("id");
                return getUserById(userId);
            } else {
                // Get all users
                return getAllUsers();
            }
        } catch (Exception e) {
            return createResponse(500, "Error retrieving users: " + e.getMessage());
        }
    }
    
    private APIGatewayProxyResponseEvent getUserById(String userId) {
        try {
            GetItemRequest request = GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("id", AttributeValue.builder().s(userId).build()))
                .build();
            
            GetItemResponse response = dynamoDbClient.getItem(request);
            
            if (response.item().isEmpty()) {
                return createResponse(404, "User not found");
            }
            
            User user = convertDynamoItemToUser(response.item());
            return createResponse(200, objectMapper.writeValueAsString(user));
            
        } catch (Exception e) {
            return createResponse(500, "Error retrieving user: " + e.getMessage());
        }
    }
    
    private APIGatewayProxyResponseEvent getAllUsers() {
        try {
            ScanRequest request = ScanRequest.builder()
                .tableName(tableName)
                .build();
            
            ScanResponse response = dynamoDbClient.scan(request);
            
            List<User> users = response.items().stream()
                .map(this::convertDynamoItemToUser)
                .toList();
            
            return createResponse(200, objectMapper.writeValueAsString(users));
            
        } catch (Exception e) {
            return createResponse(500, "Error retrieving users: " + e.getMessage());
        }
    }
    
    private APIGatewayProxyResponseEvent handlePostRequest(APIGatewayProxyRequestEvent request) {
        try {
            User user = objectMapper.readValue(request.getBody(), User.class);
            user.setId(UUID.randomUUID().toString());
            user.setCreatedAt(new Date());
            
            Map<String, AttributeValue> item = convertUserToDynamoItem(user);
            
            PutItemRequest putRequest = PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build();
            
            dynamoDbClient.putItem(putRequest);
            
            return createResponse(201, objectMapper.writeValueAsString(user));
            
        } catch (Exception e) {
            return createResponse(400, "Error creating user: " + e.getMessage());
        }
    }
    
    private APIGatewayProxyResponseEvent handlePutRequest(APIGatewayProxyRequestEvent request) {
        try {
            Map<String, String> pathParameters = request.getPathParameters();
            String userId = pathParameters.get("id");
            
            User user = objectMapper.readValue(request.getBody(), User.class);
            user.setId(userId);
            user.setUpdatedAt(new Date());
            
            Map<String, AttributeValue> item = convertUserToDynamoItem(user);
            
            PutItemRequest putRequest = PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build();
            
            dynamoDbClient.putItem(putRequest);
            
            return createResponse(200, objectMapper.writeValueAsString(user));
            
        } catch (Exception e) {
            return createResponse(400, "Error updating user: " + e.getMessage());
        }
    }
    
    private APIGatewayProxyResponseEvent handleDeleteRequest(APIGatewayProxyRequestEvent request) {
        try {
            Map<String, String> pathParameters = request.getPathParameters();
            String userId = pathParameters.get("id");
            
            DeleteItemRequest deleteRequest = DeleteItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("id", AttributeValue.builder().s(userId).build()))
                .build();
            
            dynamoDbClient.deleteItem(deleteRequest);
            
            return createResponse(204, "");
            
        } catch (Exception e) {
            return createResponse(500, "Error deleting user: " + e.getMessage());
        }
    }
    
    private User convertDynamoItemToUser(Map<String, AttributeValue> item) {
        User user = new User();
        user.setId(item.get("id").s());
        user.setName(item.get("name").s());
        user.setEmail(item.get("email").s());
        if (item.containsKey("createdAt")) {
            user.setCreatedAt(new Date(Long.parseLong(item.get("createdAt").n())));
        }
        if (item.containsKey("updatedAt")) {
            user.setUpdatedAt(new Date(Long.parseLong(item.get("updatedAt").n())));
        }
        return user;
    }
    
    private Map<String, AttributeValue> convertUserToDynamoItem(User user) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("id", AttributeValue.builder().s(user.getId()).build());
        item.put("name", AttributeValue.builder().s(user.getName()).build());
        item.put("email", AttributeValue.builder().s(user.getEmail()).build());
        
        if (user.getCreatedAt() != null) {
            item.put("createdAt", AttributeValue.builder().n(String.valueOf(user.getCreatedAt().getTime())).build());
        }
        if (user.getUpdatedAt() != null) {
            item.put("updatedAt", AttributeValue.builder().n(String.valueOf(user.getUpdatedAt().getTime())).build());
        }
        
        return item;
    }
    
    private APIGatewayProxyResponseEvent createResponse(int statusCode, String body) {
        APIGatewayProxyResponseEvent response = new APIGatewayProxyResponseEvent();
        response.setStatusCode(statusCode);
        response.setBody(body);
        
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Content-Type, Authorization");
        
        response.setHeaders(headers);
        return response;
    }
}

// User.java
class User {
    private String id;
    private String name;
    private String email;
    private Date createdAt;
    private Date updatedAt;
    
    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }
}
```

### AWS SAM Template

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Serverless User Management API

Globals:
  Function:
    Timeout: 30
    MemorySize: 512
    Runtime: java11
    Environment:
      Variables:
        USERS_TABLE: !Ref UsersTable

Resources:
  # API Gateway
  UserManagementApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
        AllowHeaders: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
        AllowOrigin: "'*'"
      Auth:
        DefaultAuthorizer: CognitoAuthorizer
        Authorizers:
          CognitoAuthorizer:
            UserPoolArn: !GetAtt UserPool.Arn

  # Lambda Functions
  UserServiceFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: target/user-service-1.0.0.jar
      Handler: com.mycompany.lambda.UserService::handleRequest
      Events:
        GetUsers:
          Type: Api
          Properties:
            RestApiId: !Ref UserManagementApi
            Path: /users
            Method: get
        GetUser:
          Type: Api
          Properties:
            RestApiId: !Ref UserManagementApi
            Path: /users/{id}
            Method: get
        CreateUser:
          Type: Api
          Properties:
            RestApiId: !Ref UserManagementApi
            Path: /users
            Method: post
        UpdateUser:
          Type: Api
          Properties:
            RestApiId: !Ref UserManagementApi
            Path: /users/{id}
            Method: put
        DeleteUser:
          Type: Api
          Properties:
            RestApiId: !Ref UserManagementApi
            Path: /users/{id}
            Method: delete
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref UsersTable

  # Event-driven Functions
  EmailNotificationFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: target/email-service-1.0.0.jar
      Handler: com.mycompany.lambda.EmailNotificationService::handleRequest
      Events:
        UserCreatedEvent:
          Type: DynamoDB
          Properties:
            Stream: !GetAtt UsersTable.StreamArn
            StartingPosition: TRIM_HORIZON
            FilterCriteria:
              Filters:
                - Pattern: '{"eventName": ["INSERT"]}'
      Policies:
        - SESCrudPolicy:
            IdentityName: "*"

  FileProcessingFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: target/file-processor-1.0.0.jar
      Handler: com.mycompany.lambda.FileProcessor::handleRequest
      Timeout: 300
      MemorySize: 1024
      Events:
        S3Event:
          Type: S3
          Properties:
            Bucket: !Ref FileUploadBucket
            Events: s3:ObjectCreated:*
            Filter:
              S3Key:
                Rules:
                  - Name: prefix
                    Value: uploads/
      Policies:
        - S3CrudPolicy:
            BucketName: !Ref FileUploadBucket

  # Scheduled Function
  DataCleanupFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: target/data-cleanup-1.0.0.jar
      Handler: com.mycompany.lambda.DataCleanupService::handleRequest
      Events:
        ScheduleEvent:
          Type: Schedule
          Properties:
            Schedule: rate(1 day)
            Input: '{"action": "cleanup_old_data"}'
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref UsersTable

  # DynamoDB Table
  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: users
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

  # S3 Bucket
  FileUploadBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${AWS::StackName}-file-uploads"
      CorsConfiguration:
        CorsRules:
          - AllowedHeaders: ['*']
            AllowedMethods: [GET, PUT, POST, DELETE, HEAD]
            AllowedOrigins: ['*']

  # Cognito User Pool
  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: !Sub "${AWS::StackName}-users"
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: true

  UserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      UserPoolId: !Ref UserPool
      ClientName: !Sub "${AWS::StackName}-client"
      GenerateSecret: false

Outputs:
  UserManagementApiUrl:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${UserManagementApi}.execute-api.${AWS::Region}.amazonaws.com/prod/"
  UserPoolId:
    Description: "Cognito User Pool ID"
    Value: !Ref UserPool
  UserPoolClientId:
    Description: "Cognito User Pool Client ID"
    Value: !Ref UserPoolClient
```

### Event-Driven Email Service

```java
// EmailNotificationService.java
package com.mycompany.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.DynamodbEvent;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.*;

public class EmailNotificationService implements RequestHandler<DynamodbEvent, String> {
    
    private final SesClient sesClient;
    
    public EmailNotificationService() {
        this.sesClient = SesClient.builder().build();
    }
    
    @Override
    public String handleRequest(DynamodbEvent event, Context context) {
        for (DynamodbEvent.DynamodbStreamRecord record : event.getRecords()) {
            if ("INSERT".equals(record.getEventName())) {
                processUserCreated(record, context);
            }
        }
        return "Success";
    }
    
    private void processUserCreated(DynamodbEvent.DynamodbStreamRecord record, Context context) {
        try {
            String userEmail = record.getDynamodb().getNewImage().get("email").getS();
            String userName = record.getDynamodb().getNewImage().get("name").getS();
            
            sendWelcomeEmail(userEmail, userName);
            
            context.getLogger().log("Welcome email sent to: " + userEmail);
            
        } catch (Exception e) {
            context.getLogger().log("Error sending email: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
    
    private void sendWelcomeEmail(String email, String name) {
        String subject = "Welcome to Our Platform!";
        String htmlBody = String.format("""
            <html>
            <body>
                <h1>Welcome, %s!</h1>
                <p>Thank you for joining our platform. We're excited to have you on board.</p>
                <p>You can now access all features of our application.</p>
                <br>
                <p>Best regards,<br>The Team</p>
            </body>
            </html>
            """, name);
        
        String textBody = String.format(
            "Welcome, %s!\n\n" +
            "Thank you for joining our platform. We're excited to have you on board.\n" +
            "You can now access all features of our application.\n\n" +
            "Best regards,\nThe Team", name);
        
        SendEmailRequest request = SendEmailRequest.builder()
            .source("noreply@mycompany.com")
            .destination(Destination.builder().toAddresses(email).build())
            .message(Message.builder()
                .subject(Content.builder().data(subject).build())
                .body(Body.builder()
                    .html(Content.builder().data(htmlBody).build())
                    .text(Content.builder().data(textBody).build())
                    .build())
                .build())
            .build();
        
        sesClient.sendEmail(request);
    }
}
```

### File Processing Service

```java
// FileProcessor.java
package com.mycompany.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.S3Event;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;

public class FileProcessor implements RequestHandler<S3Event, String> {
    
    private final S3Client s3Client;
    
    public FileProcessor() {
        this.s3Client = S3Client.builder().build();
    }
    
    @Override
    public String handleRequest(S3Event event, Context context) {
        for (S3Event.S3EventNotificationRecord record : event.getRecords()) {
            String bucketName = record.getS3().getBucket().getName();
            String objectKey = record.getS3().getObject().getKey();
            
            context.getLogger().log("Processing file: " + objectKey + " from bucket: " + bucketName);
            
            try {
                if (isImageFile(objectKey)) {
                    processImage(bucketName, objectKey, context);
                } else if (isTextFile(objectKey)) {
                    processTextFile(bucketName, objectKey, context);
                }
            } catch (Exception e) {
                context.getLogger().log("Error processing file: " + e.getMessage());
                throw new RuntimeException(e);
            }
        }
        
        return "Success";
    }
    
    private boolean isImageFile(String key) {
        String lowerKey = key.toLowerCase();
        return lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg") || 
               lowerKey.endsWith(".png") || lowerKey.endsWith(".gif");
    }
    
    private boolean isTextFile(String key) {
        String lowerKey = key.toLowerCase();
        return lowerKey.endsWith(".txt") || lowerKey.endsWith(".csv") || 
               lowerKey.endsWith(".json") || lowerKey.endsWith(".xml");
    }
    
    private void processImage(String bucketName, String objectKey, Context context) throws IOException {
        // Download original image
        GetObjectRequest getRequest = GetObjectRequest.builder()
            .bucket(bucketName)
            .key(objectKey)
            .build();
        
        ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getRequest);
        BufferedImage originalImage = ImageIO.read(s3Object);
        
        // Create thumbnail
        BufferedImage thumbnail = createThumbnail(originalImage, 200, 200);
        
        // Upload thumbnail
        ByteArrayOutputStream thumbnailStream = new ByteArrayOutputStream();
        ImageIO.write(thumbnail, "jpg", thumbnailStream);
        
        String thumbnailKey = "thumbnails/" + objectKey.replaceAll("\\.[^.]+$", "_thumb.jpg");
        
        PutObjectRequest putRequest = PutObjectRequest.builder()
            .bucket(bucketName)
            .key(thumbnailKey)
            .contentType("image/jpeg")
            .build();
        
        s3Client.putObject(putRequest, 
            software.amazon.awssdk.core.sync.RequestBody.fromBytes(thumbnailStream.toByteArray()));
        
        context.getLogger().log("Thumbnail created: " + thumbnailKey);
        
        // Add metadata
        addImageMetadata(bucketName, objectKey, originalImage.getWidth(), originalImage.getHeight());
    }
    
    private BufferedImage createThumbnail(BufferedImage original, int maxWidth, int maxHeight) {
        int originalWidth = original.getWidth();
        int originalHeight = original.getHeight();
        
        double ratio = Math.min((double) maxWidth / originalWidth, (double) maxHeight / originalHeight);
        int newWidth = (int) (originalWidth * ratio);
        int newHeight = (int) (originalHeight * ratio);
        
        BufferedImage thumbnail = new BufferedImage(newWidth, newHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = thumbnail.createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g2d.drawImage(original, 0, 0, newWidth, newHeight, null);
        g2d.dispose();
        
        return thumbnail;
    }
    
    private void addImageMetadata(String bucketName, String objectKey, int width, int height) {
        CopyObjectRequest copyRequest = CopyObjectRequest.builder()
            .sourceBucket(bucketName)
            .sourceKey(objectKey)
            .destinationBucket(bucketName)
            .destinationKey(objectKey)
            .metadata(Map.of(
                "width", String.valueOf(width),
                "height", String.valueOf(height),
                "processed", "true"
            ))
            .metadataDirective(MetadataDirective.REPLACE)
            .build();
        
        s3Client.copyObject(copyRequest);
    }
    
    private void processTextFile(String bucketName, String objectKey, Context context) {
        // Process text files (validation, conversion, etc.)
        GetObjectRequest getRequest = GetObjectRequest.builder()
            .bucket(bucketName)
            .key(objectKey)
            .build();
        
        ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getRequest);
        
        try {
            String content = new String(s3Object.readAllBytes());
            
            // Perform text processing
            String processedContent = processTextContent(content);
            
            // Save processed file
            String processedKey = "processed/" + objectKey;
            
            PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(processedKey)
                .contentType("text/plain")
                .build();
            
            s3Client.putObject(putRequest, 
                software.amazon.awssdk.core.sync.RequestBody.fromString(processedContent));
            
            context.getLogger().log("Text file processed: " + processedKey);
            
        } catch (IOException e) {
            throw new RuntimeException("Error processing text file", e);
        }
    }
    
    private String processTextContent(String content) {
        // Example text processing: word count, validation, formatting
        return content.trim().replaceAll("\\s+", " ");
    }
}
```

## Azure Functions Implementation

### Azure Function (Java)

```java
// UserFunction.java
package com.mycompany.azure;

import com.microsoft.azure.functions.*;
import com.microsoft.azure.functions.annotation.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

public class UserFunction {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @FunctionName("GetUsers")
    public HttpResponseMessage getUsers(
            @HttpTrigger(
                name = "req",
                methods = {HttpMethod.GET},
                route = "users"
            ) HttpRequestMessage<Optional<String>> request,
            final ExecutionContext context) {
        
        context.getLogger().info("Getting all users");
        
        try {
            // Simulate database call
            List<User> users = getUsersFromDatabase();
            
            return request.createResponseBuilder(HttpStatus.OK)
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(users))
                .build();
                
        } catch (Exception e) {
            context.getLogger().severe("Error getting users: " + e.getMessage());
            return request.createResponseBuilder(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error retrieving users")
                .build();
        }
    }
    
    @FunctionName("CreateUser")
    public HttpResponseMessage createUser(
            @HttpTrigger(
                name = "req",
                methods = {HttpMethod.POST},
                route = "users"
            ) HttpRequestMessage<Optional<String>> request,
            final ExecutionContext context) {
        
        context.getLogger().info("Creating new user");
        
        try {
            String requestBody = request.getBody().orElse("");
            User user = objectMapper.readValue(requestBody, User.class);
            
            // Set ID and timestamps
            user.setId(UUID.randomUUID().toString());
            user.setCreatedAt(new Date());
            
            // Save to database
            saveUserToDatabase(user);
            
            return request.createResponseBuilder(HttpStatus.CREATED)
                .header("Content-Type", "application/json")
                .body(objectMapper.writeValueAsString(user))
                .build();
                
        } catch (Exception e) {
            context.getLogger().severe("Error creating user: " + e.getMessage());
            return request.createResponseBuilder(HttpStatus.BAD_REQUEST)
                .body("Error creating user")
                .build();
        }
    }
    
    @FunctionName("ProcessFileUpload")
    public void processFileUpload(
            @BlobTrigger(
                name = "file",
                path = "uploads/{name}",
                connection = "AzureWebJobsStorage"
            ) byte[] content,
            @BindingName("name") String fileName,
            final ExecutionContext context) {
        
        context.getLogger().info("Processing uploaded file: " + fileName);
        
        try {
            // Process file content
            processFile(content, fileName, context);
            
        } catch (Exception e) {
            context.getLogger().severe("Error processing file: " + e.getMessage());
        }
    }
    
    @FunctionName("SendNotification")
    public void sendNotification(
            @CosmosDBTrigger(
                name = "items",
                databaseName = "mydb",
                collectionName = "users",
                connectionStringSetting = "CosmosDBConnection",
                createLeaseCollectionIfNotExists = true
            ) User[] users,
            final ExecutionContext context) {
        
        for (User user : users) {
            context.getLogger().info("User created/updated: " + user.getName());
            
            // Send notification email
            sendWelcomeEmail(user, context);
        }
    }
    
    @FunctionName("ScheduledCleanup")
    public void scheduledCleanup(
            @TimerTrigger(
                name = "timer",
                schedule = "0 0 2 * * *"  // Daily at 2 AM
            ) String timerInfo,
            final ExecutionContext context) {
        
        context.getLogger().info("Running scheduled cleanup");
        
        try {
            // Cleanup old data
            cleanupOldData(context);
            
        } catch (Exception e) {
            context.getLogger().severe("Error in scheduled cleanup: " + e.getMessage());
        }
    }
    
    private List<User> getUsersFromDatabase() {
        // Simulate database call
        return List.of(
            new User("1", "John Doe", "john@example.com", new Date(), null),
            new User("2", "Jane Smith", "jane@example.com", new Date(), null)
        );
    }
    
    private void saveUserToDatabase(User user) {
        // Save user to CosmosDB or other database
    }
    
    private void processFile(byte[] content, String fileName, ExecutionContext context) {
        // File processing logic
        context.getLogger().info("Processing file: " + fileName + " with size: " + content.length);
    }
    
    private void sendWelcomeEmail(User user, ExecutionContext context) {
        // Send email using SendGrid or other email service
        context.getLogger().info("Sending welcome email to: " + user.getEmail());
    }
    
    private void cleanupOldData(ExecutionContext context) {
        // Cleanup logic
        context.getLogger().info("Cleaning up old data");
    }
}
```

### Azure Function Configuration

```json
// host.json
{
  "version": "2.0",
  "functionTimeout": "00:05:00",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    }
  },
  "extensions": {
    "http": {
      "routePrefix": "api"
    }
  }
}
```

```json
// local.settings.json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=mystorageaccount;AccountKey=...",
    "FUNCTIONS_WORKER_RUNTIME": "java",
    "CosmosDBConnection": "AccountEndpoint=https://mycosmosdb.documents.azure.com:443/;AccountKey=..."
  }
}
```

## Google Cloud Functions

### Cloud Function (Java)

```java
// UserCloudFunction.java
package com.mycompany.gcp;

import com.google.cloud.functions.HttpFunction;
import com.google.cloud.functions.HttpRequest;
import com.google.cloud.functions.HttpResponse;
import com.google.cloud.functions.BackgroundFunction;
import com.google.cloud.functions.Context;
import com.google.events.cloud.storage.v1.StorageObjectData;
import com.google.gson.Gson;

import java.io.BufferedWriter;
import java.io.IOException;
import java.util.*;

public class UserCloudFunction implements HttpFunction {
    
    private final Gson gson = new Gson();
    
    @Override
    public void service(HttpRequest request, HttpResponse response) throws IOException {
        response.appendHeader("Access-Control-Allow-Origin", "*");
        response.appendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.appendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        
        String method = request.getMethod();
        String path = request.getPath();
        
        try {
            switch (method) {
                case "GET":
                    handleGetRequest(request, response);
                    break;
                case "POST":
                    handlePostRequest(request, response);
                    break;
                case "PUT":
                    handlePutRequest(request, response);
                    break;
                case "DELETE":
                    handleDeleteRequest(request, response);
                    break;
                case "OPTIONS":
                    response.setStatusCode(200);
                    break;
                default:
                    response.setStatusCode(405);
                    writeResponse(response, "Method Not Allowed");
            }
        } catch (Exception e) {
            response.setStatusCode(500);
            writeResponse(response, "Internal Server Error: " + e.getMessage());
        }
    }
    
    private void handleGetRequest(HttpRequest request, HttpResponse response) throws IOException {
        String userId = request.getFirstQueryParameter("id").orElse(null);
        
        if (userId != null) {
            User user = getUserById(userId);
            if (user != null) {
                response.setStatusCode(200);
                writeResponse(response, gson.toJson(user));
            } else {
                response.setStatusCode(404);
                writeResponse(response, "User not found");
            }
        } else {
            List<User> users = getAllUsers();
            response.setStatusCode(200);
            writeResponse(response, gson.toJson(users));
        }
    }
    
    private void handlePostRequest(HttpRequest request, HttpResponse response) throws IOException {
        String body = request.getReader().lines()
            .reduce("", (accumulator, actual) -> accumulator + actual);
        
        User user = gson.fromJson(body, User.class);
        user.setId(UUID.randomUUID().toString());
        user.setCreatedAt(new Date());
        
        saveUser(user);
        
        response.setStatusCode(201);
        writeResponse(response, gson.toJson(user));
    }
    
    private void handlePutRequest(HttpRequest request, HttpResponse response) throws IOException {
        String userId = request.getFirstQueryParameter("id").orElse(null);
        if (userId == null) {
            response.setStatusCode(400);
            writeResponse(response, "User ID is required");
            return;
        }
        
        String body = request.getReader().lines()
            .reduce("", (accumulator, actual) -> accumulator + actual);
        
        User user = gson.fromJson(body, User.class);
        user.setId(userId);
        user.setUpdatedAt(new Date());
        
        updateUser(user);
        
        response.setStatusCode(200);
        writeResponse(response, gson.toJson(user));
    }
    
    private void handleDeleteRequest(HttpRequest request, HttpResponse response) throws IOException {
        String userId = request.getFirstQueryParameter("id").orElse(null);
        if (userId == null) {
            response.setStatusCode(400);
            writeResponse(response, "User ID is required");
            return;
        }
        
        deleteUser(userId);
        response.setStatusCode(204);
    }
    
    private void writeResponse(HttpResponse response, String content) throws IOException {
        BufferedWriter writer = response.getWriter();
        writer.write(content);
    }
    
    private User getUserById(String id) {
        // Firestore query implementation
        return new User(id, "John Doe", "john@example.com", new Date(), null);
    }
    
    private List<User> getAllUsers() {
        // Firestore query implementation
        return List.of(
            new User("1", "John Doe", "john@example.com", new Date(), null),
            new User("2", "Jane Smith", "jane@example.com", new Date(), null)
        );
    }
    
    private void saveUser(User user) {
        // Firestore save implementation
    }
    
    private void updateUser(User user) {
        // Firestore update implementation
    }
    
    private void deleteUser(String id) {
        // Firestore delete implementation
    }
}

// Storage trigger function
public class FileProcessorFunction implements BackgroundFunction<StorageObjectData> {
    
    @Override
    public void accept(StorageObjectData data, Context context) {
        String fileName = data.getName();
        String bucketName = data.getBucket();
        
        context.logger().info("Processing file: " + fileName + " from bucket: " + bucketName);
        
        try {
            if (isImageFile(fileName)) {
                processImageFile(bucketName, fileName, context);
            } else if (isTextFile(fileName)) {
                processTextFile(bucketName, fileName, context);
            }
        } catch (Exception e) {
            context.logger().severe("Error processing file: " + e.getMessage());
        }
    }
    
    private boolean isImageFile(String fileName) {
        String lower = fileName.toLowerCase();
        return lower.endsWith(".jpg") || lower.endsWith(".png") || lower.endsWith(".gif");
    }
    
    private boolean isTextFile(String fileName) {
        String lower = fileName.toLowerCase();
        return lower.endsWith(".txt") || lower.endsWith(".csv") || lower.endsWith(".json");
    }
    
    private void processImageFile(String bucket, String fileName, Context context) {
        // Image processing logic
        context.logger().info("Processing image: " + fileName);
    }
    
    private void processTextFile(String bucket, String fileName, Context context) {
        // Text processing logic
        context.logger().info("Processing text file: " + fileName);
    }
}
```

## Serverless Framework Implementation

### Serverless Configuration

```yaml
# serverless.yml
service: user-management-serverless

frameworkVersion: '3'

provider:
  name: aws
  runtime: java11
  region: us-east-1
  memorySize: 512
  timeout: 30
  environment:
    USERS_TABLE: ${self:service}-users-${sls:stage}
    REGION: ${self:provider.region}
  iamRoleStatements:
    - Effect: Allow
      Action:
        - dynamodb:Query
        - dynamodb:Scan
        - dynamodb:GetItem
        - dynamodb:PutItem
        - dynamodb:UpdateItem
        - dynamodb:DeleteItem
      Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.USERS_TABLE}"
    - Effect: Allow
      Action:
        - ses:SendEmail
        - ses:SendRawEmail
      Resource: "*"
    - Effect: Allow
      Action:
        - s3:GetObject
        - s3:PutObject
        - s3:DeleteObject
      Resource: "arn:aws:s3:::${self:service}-files-${sls:stage}/*"

package:
  artifact: target/user-service-1.0.0.jar

functions:
  userService:
    handler: com.mycompany.lambda.UserService::handleRequest
    events:
      - http:
          path: /users
          method: get
          cors: true
          authorizer:
            name: cognitoAuthorizer
            type: COGNITO_USER_POOLS
            arn: ${self:custom.cognitoUserPoolArn}
      - http:
          path: /users/{id}
          method: get
          cors: true
          authorizer:
            name: cognitoAuthorizer
            type: COGNITO_USER_POOLS
            arn: ${self:custom.cognitoUserPoolArn}
      - http:
          path: /users
          method: post
          cors: true
          authorizer:
            name: cognitoAuthorizer
            type: COGNITO_USER_POOLS
            arn: ${self:custom.cognitoUserPoolArn}
      - http:
          path: /users/{id}
          method: put
          cors: true
          authorizer:
            name: cognitoAuthorizer
            type: COGNITO_USER_POOLS
            arn: ${self:custom.cognitoUserPoolArn}
      - http:
          path: /users/{id}
          method: delete
          cors: true
          authorizer:
            name: cognitoAuthorizer
            type: COGNITO_USER_POOLS
            arn: ${self:custom.cognitoUserPoolArn}

  emailNotificationService:
    handler: com.mycompany.lambda.EmailNotificationService::handleRequest
    events:
      - stream:
          type: dynamodb
          arn:
            Fn::GetAtt: [UsersTable, StreamArn]
          filterPatterns:
            - eventName: [INSERT]

  fileProcessor:
    handler: com.mycompany.lambda.FileProcessor::handleRequest
    timeout: 300
    memorySize: 1024
    events:
      - s3:
          bucket: ${self:service}-files-${sls:stage}
          event: s3:ObjectCreated:*
          rules:
            - prefix: uploads/

  dataCleanup:
    handler: com.mycompany.lambda.DataCleanupService::handleRequest
    events:
      - schedule:
          rate: rate(1 day)
          input:
            action: cleanup_old_data

resources:
  Resources:
    UsersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.USERS_TABLE}
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH
        BillingMode: PAY_PER_REQUEST
        StreamSpecification:
          StreamViewType: NEW_AND_OLD_IMAGES

    CognitoUserPool:
      Type: AWS::Cognito::UserPool
      Properties:
        UserPoolName: ${self:service}-users-${sls:stage}
        Policies:
          PasswordPolicy:
            MinimumLength: 8
            RequireUppercase: true
            RequireLowercase: true
            RequireNumbers: true
            RequireSymbols: true

    CognitoUserPoolClient:
      Type: AWS::Cognito::UserPoolClient
      Properties:
        UserPoolId: !Ref CognitoUserPool
        ClientName: ${self:service}-client-${sls:stage}
        GenerateSecret: false

custom:
  cognitoUserPoolArn: !GetAtt CognitoUserPool.Arn

plugins:
  - serverless-offline
  - serverless-domain-manager
  - serverless-plugin-warmup

useDotenv: true
```

## Monitoring ve Debugging

### CloudWatch Logs Implementation

```java
// LoggingService.java
package com.mycompany.lambda.utils;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;

public class LoggingService {
    
    private final LambdaLogger logger;
    private final ObjectMapper objectMapper;
    private final String functionName;
    private final String requestId;
    
    public LoggingService(Context context) {
        this.logger = context.getLogger();
        this.objectMapper = new ObjectMapper();
        this.functionName = context.getFunctionName();
        this.requestId = context.getAwsRequestId();
    }
    
    public void logInfo(String message, Object... params) {
        log("INFO", message, null, params);
    }
    
    public void logError(String message, Throwable throwable, Object... params) {
        log("ERROR", message, throwable, params);
    }
    
    public void logWarning(String message, Object... params) {
        log("WARN", message, null, params);
    }
    
    public void logDebug(String message, Object... params) {
        log("DEBUG", message, null, params);
    }
    
    private void log(String level, String message, Throwable throwable, Object... params) {
        try {
            Map<String, Object> logEntry = new HashMap<>();
            logEntry.put("timestamp", System.currentTimeMillis());
            logEntry.put("level", level);
            logEntry.put("message", String.format(message, params));
            logEntry.put("functionName", functionName);
            logEntry.put("requestId", requestId);
            
            if (throwable != null) {
                logEntry.put("error", throwable.getMessage());
                logEntry.put("stackTrace", getStackTrace(throwable));
            }
            
            String jsonLog = objectMapper.writeValueAsString(logEntry);
            logger.log(jsonLog);
            
        } catch (Exception e) {
            // Fallback to simple logging
            logger.log(level + ": " + message);
        }
    }
    
    private String getStackTrace(Throwable throwable) {
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        throwable.printStackTrace(pw);
        return sw.toString();
    }
}
```

### Performance Monitoring

```java
// MetricsService.java
package com.mycompany.lambda.utils;

import software.amazon.awssdk.services.cloudwatch.CloudWatchClient;
import software.amazon.awssdk.services.cloudwatch.model.*;

import java.time.Instant;
import java.util.List;

public class MetricsService {
    
    private final CloudWatchClient cloudWatchClient;
    private final String namespace = "Lambda/CustomMetrics";
    
    public MetricsService() {
        this.cloudWatchClient = CloudWatchClient.builder().build();
    }
    
    public void recordExecutionTime(String functionName, long executionTimeMs) {
        putMetric("ExecutionTime", executionTimeMs, StandardUnit.MILLISECONDS, functionName);
    }
    
    public void recordMemoryUsage(String functionName, long memoryUsedMB) {
        putMetric("MemoryUsage", memoryUsedMB, StandardUnit.NONE, functionName);
    }
    
    public void recordCustomMetric(String metricName, double value, StandardUnit unit, String functionName) {
        putMetric(metricName, value, unit, functionName);
    }
    
    public void recordCounter(String metricName, String functionName) {
        putMetric(metricName, 1.0, StandardUnit.COUNT, functionName);
    }
    
    private void putMetric(String metricName, double value, StandardUnit unit, String functionName) {
        try {
            Dimension functionDimension = Dimension.builder()
                .name("FunctionName")
                .value(functionName)
                .build();
            
            MetricDatum metricDatum = MetricDatum.builder()
                .metricName(metricName)
                .value(value)
                .unit(unit)
                .timestamp(Instant.now())
                .dimensions(functionDimension)
                .build();
            
            PutMetricDataRequest request = PutMetricDataRequest.builder()
                .namespace(namespace)
                .metricData(List.of(metricDatum))
                .build();
            
            cloudWatchClient.putMetricData(request);
            
        } catch (Exception e) {
            // Log error but don't fail the function
            System.err.println("Failed to put metric: " + e.getMessage());
        }
    }
}
```

## Best Practices

### Cold Start Optimization

```java
// OptimizedLambdaFunction.java
package com.mycompany.lambda.optimized;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

public class OptimizedLambdaFunction implements RequestHandler<Object, String> {
    
    // Initialize outside the handler for reuse across invocations
    private static final DynamoDbClient dynamoDbClient = DynamoDbClient.builder().build();
    private static final ObjectMapper objectMapper = new ObjectMapper();
    
    // Connection pooling for database connections
    private static final ConnectionPool connectionPool = initializeConnectionPool();
    
    static {
        // Eager initialization of expensive resources
        initializeConfigurations();
    }
    
    @Override
    public String handleRequest(Object input, Context context) {
        long startTime = System.currentTimeMillis();
        
        try {
            // Your business logic here
            String result = processRequest(input);
            
            // Log execution time
            long executionTime = System.currentTimeMillis() - startTime;
            context.getLogger().log("Execution time: " + executionTime + "ms");
            
            return result;
            
        } catch (Exception e) {
            context.getLogger().log("Error: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
    
    private static ConnectionPool initializeConnectionPool() {
        // Initialize connection pool
        return new ConnectionPool();
    }
    
    private static void initializeConfigurations() {
        // Load configurations, warm up connections, etc.
    }
    
    private String processRequest(Object input) {
        // Business logic implementation
        return "Success";
    }
}
```

### Error Handling ve Retry Logic

```java
// ResilientLambdaFunction.java
package com.mycompany.lambda.resilient;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;

public class ResilientLambdaFunction implements RequestHandler<Object, String> {
    
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 1000;
    
    @Override
    public String handleRequest(Object input, Context context) {
        return executeWithRetry(() -> processRequest(input), context);
    }
    
    private <T> T executeWithRetry(java.util.function.Supplier<T> operation, Context context) {
        Exception lastException = null;
        
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return operation.get();
            } catch (Exception e) {
                lastException = e;
                context.getLogger().log("Attempt " + attempt + " failed: " + e.getMessage());
                
                if (attempt < MAX_RETRIES) {
                    try {
                        Thread.sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted during retry", ie);
                    }
                }
            }
        }
        
        throw new RuntimeException("All retry attempts failed", lastException);
    }
    
    private String processRequest(Object input) {
        // Business logic that might fail
        return "Success";
    }
}
```

## Deployment ve CI/CD

### GitHub Actions Deployment

```yaml
# .github/workflows/deploy-serverless.yml
name: Deploy Serverless Application

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 11
      uses: actions/setup-java@v3
      with:
        java-version: '11'
        distribution: 'temurin'
    
    - name: Run tests
      run: mvn clean test
    
    - name: Run integration tests
      run: mvn verify

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 11
      uses: actions/setup-java@v3
      with:
        java-version: '11'
        distribution: 'temurin'
    
    - name: Build application
      run: mvn clean package
    
    - name: Setup Serverless Framework
      uses: serverless/github-action@v3
      with:
        args: deploy --stage production
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

Bu kapsamlı Serverless ve FaaS rehberi, modern bulut uygulamalarınızı event-driven mimaride geliştirmeniz için gereken tüm bilgileri içermektedir. Serverless teknolojilerini kullanarak maliyet-etkin, ölçeklenebilir ve yönetilebilir uygulamalar geliştirebilirsiniz.
