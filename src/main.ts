import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import process from 'node:process'; 
console.log(`The process ID is: ${process.pid}`); 


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  

   // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Your API Title')
    .setDescription('A description of your API')
    .setVersion('1.0')
    .addTag('your-tag') // Optional: Add tags for categorization
    .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document); // 'api-docs' is the endpoint for Swagger UI
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
