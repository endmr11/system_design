# Infrastructure as Code (IaC)

Infrastructure as Code (IaC), modern yazılım geliştirme süreçlerinin temel taşlarından biri haline gelmiştir. Bu yaklaşım, altyapı kaynaklarının kod aracılığıyla tanımlanması, dağıtılması ve yönetilmesi prensibiyle çalışır. Geleneksel manuel altyapı yönetiminin yerini alan IaC, tekrarlanabilir, güvenilir ve ölçeklenebilir altyapı yönetimi sunar.

IaC'nin temel felsefi, "altyapı da kod gibi versiyonlanmalı ve yönetilmelidir" düşüncesidir. Bu sayede altyapı değişiklikleri, uygulama kodu değişiklikleri gibi test edilebilir, gözden geçirilebilir ve güvenli bir şekilde dağıtılabilir. DevOps kültürünün ayrılmaz bir parçası olan IaC, geliştirme ve operasyon ekipleri arasındaki işbirliğini güçlendirir.

## IaC'nin Temel Prensipleri ve Avantajları

Infrastructure as Code yaklaşımı, altyapı yönetiminde köklü değişiklikler getiren bir paradigmadır. Bu yaklaşımın benimsenmesi, organizasyonlara sayısız avantaj sağlar ve modern yazılım geliştirme süreçlerinin vazgeçilmez bir parçası haline gelir.

### Tutarlılık ve Standardizasyon

IaC'nin en önemli avantajlarından biri, tüm ortamlarda tutarlı altyapı konfigürasyonu sağlamasıdır. Geliştirme, test, staging ve production ortamları arasındaki farklılıklar minimize edilir. Bu durum, "benim makinemde çalışıyor" (works on my machine) problemini büyük ölçüde ortadan kaldırır.

**Environment Parity**: Development ortamında test edilen altyapı konfigürasyonu, production ortamında da aynı şekilde çalışır. Bu sayede deployment sürecinde yaşanan sürprizler azalır ve uygulamaların farklı ortamlar arasında sorunsuz çalışması sağlanır.

**Configuration Drift Prevention**: Altyapı bileşenlerinin zaman içinde beklenmeyen değişikliklere uğraması (configuration drift) sorunu, IaC ile önlenir. Kod repository'sindeki tanımlar, altyapının gerçek durumunun tek source of truth'u haline gelir.

### Hız ve Operasyonel Verimlilik

Manuel altyapı kurulumları saatler hatta günler sürebilirken, IaC ile aynı işlemler dakikalar içinde tamamlanabilir. Bu hız artışı, özellikle mikroservis mimarilerinde kritik önem taşır.

**Paralel Kaynak Oluşturma**: Terraform gibi araçlar, birbirine bağımlı olmayan kaynakları paralel olarak oluşturabilir. Bu özellik, büyük ve karmaşık altyapıların kurulum süresini önemli ölçüde kısaltır.

**Otomatik Skalasyon**: Auto Scaling Group'lar, Load Balancer'lar ve diğer dinamik bileşenler IaC ile tanımlandığında, sistemin ihtiyaca göre otomatik olarak büyümesi veya küçülmesi sağlanır.

### Güvenlik ve Compliance

IaC, güvenlik politikalarının kod seviyesinde tanımlanmasını ve uygulanmasını mümkün kılar. Security-as-Code yaklaşımı ile güvenlik kontrolleri, altyapının ayrılmaz bir parçası haline gelir.

**Policy-as-Code**: Open Policy Agent (OPA) gibi araçlarla güvenlik politikaları kod olarak tanımlanır ve IaC şablonlarına otomatik olarak uygulanır.

**Audit Trail**: Tüm altyapı değişiklikleri git history'sinde takip edilir, kim ne zaman hangi değişikliği yaptığı kolayca izlenebilir.

## Terraform ile Kapsamlı Altyapı Yönetimi

Terraform, HashiCorp tarafından geliştirilen ve çoklu cloud provider desteği sunan bir Infrastructure as Code aracıdır. Declarative (bildirimsel) yaklaşımı benimseyen Terraform, istenilen altyapı durumunu tanımlar ve mevcut durumla karşılaştırarak gerekli değişiklikleri otomatik olarak uygular.

### Terraform'un Temel Avantajları

**Multi-Cloud Destekleme**: AWS, Azure, Google Cloud Platform, Kubernetes ve 1000'den fazla provider ile çalışabilir. Bu esneklik, vendor lock-in'den kaçınmayı ve hibrit bulut stratejileri geliştirmeyi mümkün kılar.

**State Management**: Terraform state dosyası, altyapının mevcut durumunu tutar. Bu sayede hangi kaynakların zaten mevcut olduğu, hangilerinin oluşturulması gerektiği ve hangilerinin silinmesi gerektiği belirlenebilir.

**Plan ve Apply Cycle**: `terraform plan` komutu ile yapılacak değişiklikler önceden görülebilir ve doğrulanabilir. Bu yaklaşım, beklenmeyen değişiklikleri önler ve güvenli deployment sağlar.

### Spring Boot Uygulaması için AWS Altyapısı

Spring Boot uygulamalarının production ortamında çalışması için gerekli AWS altyapısı, Terraform ile sistematik olarak tanımlanabilir. Bu yaklaşım, hem güvenilirlik hem de ölçeklenebilirlik açısından kritik önem taşır.

#### Network Altyapısı Tasarımı

Modern cloud mimarisinin temelini oluşturan VPC (Virtual Private Cloud) yapısı, güvenlik ve performans açısından dikkatlice tasarlanmalıdır. Çok katmanlı mimari (multi-tier architecture) yaklaşımıyla public ve private subnet'ler ayrıştırılarak, güvenlik zonlaması oluşturulur.

**Public Subnet'ler**: Internet erişimi olan ve Load Balancer, NAT Gateway gibi bileşenlerin yerleştirildiği alanlar. Bu subnet'lerde çalışan kaynaklar, Internet Gateway üzerinden doğrudan internet erişimine sahiptir.

**Private Subnet'ler**: Uygulama sunucuları ve veritabanlarının çalıştığı, doğrudan internet erişimi olmayan güvenli alanlar. Bu subnet'lerdeki kaynaklar, NAT Gateway veya NAT Instance üzerinden kontrollü internet erişimi sağlar.

#### Güvenlik Grupları ve Network ACL'ler

AWS Security Group'lar, sanal güvenlik duvarları görevi görür ve trafik kontrolü sağlar. Spring Boot uygulamaları için tipik güvenlik grup konfigürasyonu şunları içerir:

**Application Security Group**: Spring Boot uygulamasının dinlediği port (genellikle 8080) için Load Balancer'dan gelen trafiği kabul eder. SSH erişimi sadece belirli IP aralıklarından veya bastion host'lardan izin verilir.

**Database Security Group**: Sadece uygulama sunucularından gelen veritabanı bağlantılarını kabul eder. Bu yaklaşım, veritabanına doğrudan erişimi engeller ve additional security layer sağlar.

#### Auto Scaling ve High Availability

Production ortamında çalışan Spring Boot uygulamaları, değişken yük durumlarına adaptasyon gösterebilmeli ve yüksek erişilebilirlik sağlamalıdır.

**Auto Scaling Group**: CPU kullanımı, memory consumption veya custom metric'lere dayalı olarak instance sayısını otomatik olarak artırıp azaltır.

**Multi-AZ Deployment**: Uygulamanın birden fazla Availability Zone'da çalışması, doğal afetler veya AWS altyapı sorunlarına karşı koruma sağlar.

```hcl
# variables.tf
variable "app_name" {
  description = "Spring Boot application name"
  type        = string
  default     = "spring-boot-app"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "instance_count" {
  description = "Number of EC2 instances"
  type        = number
  default     = 2
}

# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "my-terraform-state-bucket"
    key    = "spring-boot-app/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = "us-west-2"
}

# VPC ve Networking
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.app_name}-vpc"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.app_name}-public-subnet-${count.index + 1}"
    Type = "Public"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.app_name}-private-subnet-${count.index + 1}"
    Type = "Private"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.app_name}-igw"
  }
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.app_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Security Groups
resource "aws_security_group" "app" {
  name_prefix = "${var.app_name}-app-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-app-sg"
  }
}

# Load Balancer
resource "aws_lb" "main" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Environment = var.environment
  }
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.app_name}-alb-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Target Group
resource "aws_lb_target_group" "app" {
  name     = "${var.app_name}-tg"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/actuator/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.app_name}-tg"
  }
}

# ALB Listener
resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# RDS Database
resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.app_name}-rds-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name = "${var.app_name}-rds-sg"
  }
}

resource "aws_db_instance" "main" {
  identifier             = "${var.app_name}-db"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.t3.micro"
  
  db_name  = "appdb"
  username = "dbuser"
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window          = "07:00-09:00"
  maintenance_window     = "sun:09:00-sun:11:00"
  
  skip_final_snapshot = true
  deletion_protection = false

  tags = {
    Name = "${var.app_name}-database"
  }
}

resource "random_password" "db_password" {
  length  = 16
  special = true
}

# Launch Template
resource "aws_launch_template" "app" {
  name_prefix   = "${var.app_name}-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  
  vpc_security_group_ids = [aws_security_group.app.id]
  
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    db_host     = aws_db_instance.main.endpoint
    db_name     = aws_db_instance.main.db_name
    db_username = aws_db_instance.main.username
    db_password = random_password.db_password.result
    app_name    = var.app_name
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.app_name}-instance"
    }
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "app" {
  name                = "${var.app_name}-asg"
  vpc_zone_identifier = aws_subnet.public[*].id
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"
  
  min_size         = 1
  max_size         = 5
  desired_capacity = var.instance_count

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.app_name}-asg-instance"
    propagate_at_launch = true
  }
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
```

### User Data Script

```bash
#!/bin/bash
# user_data.sh

yum update -y
yum install -y java-17-amazon-corretto docker

# Start Docker
systemctl start docker
systemctl enable docker

# Create application user
useradd -m -s /bin/bash springboot

# Create application directories
mkdir -p /opt/springboot
chown springboot:springboot /opt/springboot

# Download application JAR (from S3 or build server)
cd /opt/springboot
wget https://your-artifacts-bucket.s3.amazonaws.com/${app_name}/latest/${app_name}.jar

# Create application configuration
cat > application.yml << EOF
spring:
  datasource:
    url: jdbc:postgresql://${db_host}:5432/${db_name}
    username: ${db_username}
    password: ${db_password}
    driver-class-name: org.postgresql.Driver
  
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always

logging:
  level:
    com.yourcompany: INFO
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
EOF

# Create systemd service
cat > /etc/systemd/system/${app_name}.service << EOF
[Unit]
Description=${app_name} Spring Boot Application
After=network.target

[Service]
Type=simple
User=springboot
ExecStart=/usr/bin/java -jar /opt/springboot/${app_name}.jar --spring.config.location=/opt/springboot/application.yml
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${app_name}

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown springboot:springboot /opt/springboot/*
chmod +x /opt/springboot/${app_name}.jar

# Start service
systemctl daemon-reload
systemctl enable ${app_name}
systemctl start ${app_name}

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "metrics": {
    "namespace": "SpringBoot/${app_name}",
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
        "metrics_collection_interval": 60
      },
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/messages",
            "log_group_name": "/aws/ec2/${app_name}/system",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent
```

### Outputs

```hcl
# outputs.tf
output "load_balancer_dns" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "database_password" {
  description = "Database password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}
```

## AWS CloudFormation ile Native IaC

AWS CloudFormation, Amazon Web Services'in kendi geliştirdiği native Infrastructure as Code çözümüdür. JSON veya YAML formatında yazılan template'ler kullanarak AWS kaynaklarını tanımlar ve yönetir. CloudFormation'ın en büyük avantajı, AWS ekosistemi ile derin entegrasyonu ve yeni AWS servislerine olan hızlı desteğidir.

### CloudFormation'ın Temel Avantajları

**AWS Native Integration**: AWS'nin yeni çıkan servisleri, genellikle ilk olarak CloudFormation'da desteklenir. Bu durum, cutting-edge AWS özelliklerini hızlıca kullanmaya başlamak için önemlidir.

**Stack Management**: CloudFormation, kaynakları stack'ler halinde gruplar. Bu yaklaşım, ilgili kaynakların bir arada yönetilmesini ve toplu olarak silinmesini sağlar.

**Drift Detection**: CloudFormation, template ile gerçek altyapı durumu arasındaki farkları tespit edebilir ve bu farkları düzeltme önerilerinde bulunur.

**Change Sets**: Değişikliklerin uygulanmadan önce preview edilmesini sağlar. Bu özellik, risk yönetimi açısından kritik öneme sahiptir.

### Spring Boot için CloudFormation Template

Spring Boot uygulamalarının AWS'de deploy edilmesi için gerekli tüm bileşenlerin CloudFormation ile tanımlanması, tutarlı ve tekrarlanabilir deployment'lar sağlar.

```yaml
# spring-boot-infrastructure.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Production-ready Spring Boot Application Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]
    Description: 'Deployment environment'
  
  InstanceType:
    Type: String
    Default: t3.medium
    AllowedValues: [t3.small, t3.medium, t3.large, t3.xlarge]
    Description: 'EC2 instance type for Spring Boot application'
    
  MinInstances:
    Type: Number
    Default: 2
    MinValue: 1
    MaxValue: 10
    Description: 'Minimum number of instances in ASG'
    
  MaxInstances:
    Type: Number
    Default: 10
    MinValue: 1
    MaxValue: 20
    Description: 'Maximum number of instances in ASG'

  ArtifactS3Bucket:
    Type: String
    Description: 'S3 bucket containing Spring Boot JAR file'
    
  ArtifactS3Key:
    Type: String
    Description: 'S3 key for Spring Boot JAR file'

Resources:
  # VPC ve Network Components
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-spring-boot-vpc'
        - Key: Environment
          Value: !Ref Environment

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-spring-boot-igw'

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # Public Subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-public-subnet-1'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-public-subnet-2'

  # Private Subnets
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.10.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-private-subnet-1'

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.11.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-private-subnet-2'

  # Route Tables
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-public-rt'

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: AttachGateway
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnetRouteTableAssociation1:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !Ref PublicRouteTable

  PublicSubnetRouteTableAssociation2:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet2
      RouteTableId: !Ref PublicRouteTable

  # Security Groups
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: 'Security group for Application Load Balancer'
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
          Description: 'HTTP access'
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
          Description: 'HTTPS access'
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-alb-sg'

  ApplicationSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: 'Security group for Spring Boot application'
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 8080
          ToPort: 8080
          SourceSecurityGroupId: !Ref ALBSecurityGroup
          Description: 'HTTP from ALB'
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: 10.0.0.0/16
          Description: 'SSH from VPC'
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-app-sg'

  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub '${Environment}-spring-boot-alb'
      Type: application
      Scheme: internet-facing
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-spring-boot-alb'

  # Target Group
  SpringBootTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub '${Environment}-spring-boot-tg'
      Port: 8080
      Protocol: HTTP
      VpcId: !Ref VPC
      HealthCheckPath: /actuator/health
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      TargetGroupAttributes:
        - Key: deregistration_delay.timeout_seconds
          Value: '300'
        - Key: stickiness.enabled
          Value: 'false'

  # ALB Listener
  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref SpringBootTargetGroup
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 80
      Protocol: HTTP

  # IAM Role for EC2 instances
  EC2Role:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
      Policies:
        - PolicyName: S3ArtifactAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:GetObject
                Resource: !Sub '${ArtifactS3Bucket}/${ArtifactS3Key}'

  InstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref EC2Role

  # Launch Template
  LaunchTemplate:
    Type: AWS::EC2::LaunchTemplate
    Properties:
      LaunchTemplateName: !Sub '${Environment}-spring-boot-lt'
      LaunchTemplateData:
        ImageId: ami-0c02fb55956c7d316  # Amazon Linux 2 AMI
        InstanceType: !Ref InstanceType
        SecurityGroupIds:
          - !Ref ApplicationSecurityGroup
        IamInstanceProfile:
          Arn: !GetAtt InstanceProfile.Arn
        TagSpecifications:
          - ResourceType: instance
            Tags:
              - Key: Name
                Value: !Sub '${Environment}-spring-boot-instance'
              - Key: Environment
                Value: !Ref Environment
        UserData:
          Fn::Base64: !Sub |
            #!/bin/bash
            
            # System Updates
            yum update -y
            yum install -y java-17-amazon-corretto wget
            
            # Create application user
            useradd -m -s /bin/bash springboot
            
            # Create application directories
            mkdir -p /opt/springboot/logs
            chown -R springboot:springboot /opt/springboot
            
            # Download Spring Boot application from S3
            aws s3 cp s3://${ArtifactS3Bucket}/${ArtifactS3Key} /opt/springboot/application.jar
            chown springboot:springboot /opt/springboot/application.jar
            chmod +x /opt/springboot/application.jar
            
            # Create application configuration
            cat > /opt/springboot/application.yml << 'EOL'
            server:
              port: 8080
            
            management:
              endpoints:
                web:
                  exposure:
                    include: health,info,metrics,prometheus
                health:
                  show-details: always
              endpoint:
                health:
                  probes:
                    enabled: true
            
            logging:
              level:
                com.mycompany: INFO
                root: WARN
              file:
                name: /opt/springboot/logs/application.log
              pattern:
                file: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
            
            spring:
              profiles:
                active: ${Environment}
            EOL
            
            # Create systemd service
            cat > /etc/systemd/system/springboot.service << 'EOL'
            [Unit]
            Description=Spring Boot Application
            After=network.target
            
            [Service]
            Type=simple
            User=springboot
            Group=springboot
            WorkingDirectory=/opt/springboot
            ExecStart=/usr/bin/java -Xmx1g -Xms512m -jar /opt/springboot/application.jar --spring.config.location=/opt/springboot/application.yml
            Restart=always
            RestartSec=10
            StandardOutput=journal
            StandardError=journal
            SyslogIdentifier=springboot
            
            [Install]
            WantedBy=multi-user.target
            EOL
            
            # Install and configure CloudWatch agent
            wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
            rpm -U ./amazon-cloudwatch-agent.rpm
            
            # CloudWatch agent configuration
            cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOL'
            {
              "metrics": {
                "namespace": "SpringBoot/${Environment}",
                "metrics_collected": {
                  "cpu": {
                    "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
                    "metrics_collection_interval": 60
                  },
                  "mem": {
                    "measurement": ["mem_used_percent"],
                    "metrics_collection_interval": 60
                  },
                  "disk": {
                    "measurement": ["used_percent"],
                    "metrics_collection_interval": 60,
                    "resources": ["*"]
                  }
                }
              },
              "logs": {
                "logs_collected": {
                  "files": {
                    "collect_list": [
                      {
                        "file_path": "/opt/springboot/logs/application.log",
                        "log_group_name": "/aws/ec2/springboot/${Environment}",
                        "log_stream_name": "{instance_id}"
                      }
                    ]
                  }
                }
              }
            }
            EOL
            
            # Start services
            systemctl daemon-reload
            systemctl enable springboot
            systemctl start springboot
            systemctl enable amazon-cloudwatch-agent
            systemctl start amazon-cloudwatch-agent
            
            # Wait for application to be ready
            sleep 30
            curl -f http://localhost:8080/actuator/health || echo "Application health check failed"

  # Auto Scaling Group
  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      AutoScalingGroupName: !Sub '${Environment}-spring-boot-asg'
      VPCZoneIdentifier:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      LaunchTemplate:
        LaunchTemplateId: !Ref LaunchTemplate
        Version: !GetAtt LaunchTemplate.LatestVersionNumber
      MinSize: !Ref MinInstances
      MaxSize: !Ref MaxInstances
      DesiredCapacity: !Ref MinInstances
      TargetGroupARNs:
        - !Ref SpringBootTargetGroup
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-spring-boot-asg-instance'
          PropagateAtLaunch: true
        - Key: Environment
          Value: !Ref Environment
          PropagateAtLaunch: true

  # Auto Scaling Policies
  ScaleUpPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AdjustmentType: ChangeInCapacity
      AutoScalingGroupName: !Ref AutoScalingGroup
      Cooldown: 300
      ScalingAdjustment: 1
      PolicyType: SimpleScaling

  ScaleDownPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AdjustmentType: ChangeInCapacity
      AutoScalingGroupName: !Ref AutoScalingGroup
      Cooldown: 300
      ScalingAdjustment: -1
      PolicyType: SimpleScaling

  # CloudWatch Alarms
  CPUAlarmHigh:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: 'Scale up on high CPU'
      MetricName: CPUUtilization
      Namespace: AWS/EC2
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 70
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref ScaleUpPolicy
      Dimensions:
        - Name: AutoScalingGroupName
          Value: !Ref AutoScalingGroup

  CPUAlarmLow:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: 'Scale down on low CPU'
      MetricName: CPUUtilization
      Namespace: AWS/EC2
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 25
      ComparisonOperator: LessThanThreshold
      AlarmActions:
        - !Ref ScaleDownPolicy
      Dimensions:
        - Name: AutoScalingGroupName
          Value: !Ref AutoScalingGroup

Outputs:
  LoadBalancerDNS:
    Description: 'DNS name of the Application Load Balancer'
    Value: !GetAtt ApplicationLoadBalancer.DNSName
    Export:
      Name: !Sub '${Environment}-spring-boot-alb-dns'

  LoadBalancerURL:
    Description: 'URL of the Application Load Balancer'
    Value: !Sub 'http://${ApplicationLoadBalancer.DNSName}'
    Export:
      Name: !Sub '${Environment}-spring-boot-alb-url'

  AutoScalingGroupName:
    Description: 'Name of the Auto Scaling Group'
    Value: !Ref AutoScalingGroup
    Export:
      Name: !Sub '${Environment}-spring-boot-asg-name'

  VPCId:
    Description: 'VPC ID'
    Value: !Ref VPC
    Export:
      Name: !Sub '${Environment}-vpc-id'
```

### Nested Stacks ile Modüler Yaklaşım

Büyük ve karmaşık altyapılar için CloudFormation nested stack'leri kullanarak modüler bir yaklaşım benimsenebilir. Bu yöntem, kodu organize etmeyi ve farklı bileşenleri bağımsız olarak yönetmeyi kolaylaştırır.

```yaml
# master-stack.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Master stack for Spring Boot application'

Parameters:
  Environment:
    Type: String
    Default: dev

Resources:
  NetworkStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://my-templates-bucket.s3.amazonaws.com/network-stack.yaml
      Parameters:
        Environment: !Ref Environment

  DatabaseStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://my-templates-bucket.s3.amazonaws.com/database-stack.yaml
      Parameters:
        Environment: !Ref Environment
        VPCId: !GetAtt NetworkStack.Outputs.VPCId
        PrivateSubnetIds: !GetAtt NetworkStack.Outputs.PrivateSubnetIds

  ApplicationStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://my-templates-bucket.s3.amazonaws.com/application-stack.yaml
      Parameters:
        Environment: !Ref Environment
        VPCId: !GetAtt NetworkStack.Outputs.VPCId
        PublicSubnetIds: !GetAtt NetworkStack.Outputs.PublicSubnetIds
        PrivateSubnetIds: !GetAtt NetworkStack.Outputs.PrivateSubnetIds
        DatabaseEndpoint: !GetAtt DatabaseStack.Outputs.DatabaseEndpoint
```

## Ansible ile Configuration Management

Ansible, agentless configuration management aracıdır ve IaC'nin configuration kısmını çok iyi yönetir.

### Spring Boot Deployment Playbook

```yaml
# playbook.yml
---
- name: Deploy Spring Boot Application
  hosts: app_servers
  become: yes
  vars:
    app_name: "spring-boot-app"
    app_version: "{{ lookup('env', 'APP_VERSION') | default('latest') }}"
    app_port: 8080
    java_version: "17"
    
  tasks:
    - name: Update system packages
      yum:
        name: "*"
        state: latest
      when: ansible_os_family == "RedHat"
    
    - name: Install Java {{ java_version }}
      yum:
        name: "java-{{ java_version }}-amazon-corretto"
        state: present
    
    - name: Create application user
      user:
        name: "{{ app_name }}"
        system: yes
        shell: /bin/bash
        home: "/opt/{{ app_name }}"
        create_home: yes
    
    - name: Create application directories
      file:
        path: "{{ item }}"
        state: directory
        owner: "{{ app_name }}"
        group: "{{ app_name }}"
        mode: '0755'
      loop:
        - "/opt/{{ app_name }}"
        - "/opt/{{ app_name }}/logs"
        - "/opt/{{ app_name }}/config"
        - "/opt/{{ app_name }}/backup"
    
    - name: Download application JAR
      get_url:
        url: "https://your-artifacts.s3.amazonaws.com/{{ app_name }}/{{ app_version }}/{{ app_name }}.jar"
        dest: "/opt/{{ app_name }}/{{ app_name }}.jar"
        owner: "{{ app_name }}"
        group: "{{ app_name }}"
        mode: '0755'
      notify: restart application
    
    - name: Template application configuration
      template:
        src: application.yml.j2
        dest: "/opt/{{ app_name }}/config/application.yml"
        owner: "{{ app_name }}"
        group: "{{ app_name }}"
        mode: '0644'
      notify: restart application
    
    - name: Template systemd service
      template:
        src: spring-boot.service.j2
        dest: "/etc/systemd/system/{{ app_name }}.service"
        mode: '0644'
      notify:
        - reload systemd
        - restart application
    
    - name: Start and enable application service
      systemd:
        name: "{{ app_name }}"
        state: started
        enabled: yes
        daemon_reload: yes
    
    - name: Wait for application to be ready
      uri:
        url: "http://localhost:{{ app_port }}/actuator/health"
        method: GET
        return_content: yes
      register: health_check
      until: health_check.status == 200
      retries: 30
      delay: 10
    
    - name: Configure log rotation
      template:
        src: logrotate.j2
        dest: "/etc/logrotate.d/{{ app_name }}"
        mode: '0644'
  
  handlers:
    - name: reload systemd
      systemd:
        daemon_reload: yes
    
    - name: restart application
      systemd:
        name: "{{ app_name }}"
        state: restarted
```

### Jinja2 Templates

```yaml
# templates/application.yml.j2
spring:
  datasource:
    url: jdbc:postgresql://{{ database_host }}:5432/{{ database_name }}
    username: {{ database_username }}
    password: {{ database_password }}
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
  
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true

  redis:
    host: {{ redis_host }}
    port: 6379
    password: {{ redis_password }}
    timeout: 2000ms
    lettuce:
      pool:
        max-active: 20
        max-idle: 8
        min-idle: 2

server:
  port: {{ app_port }}
  tomcat:
    max-threads: 200
    min-spare-threads: 10
    connection-timeout: 20000

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
    metrics:
      enabled: true

logging:
  level:
    com.yourcompany: {{ log_level | default('INFO') }}
    org.springframework.security: DEBUG
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
    file: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
  file:
    name: "/opt/{{ app_name }}/logs/application.log"

app:
  security:
    jwt:
      secret: {{ jwt_secret }}
      expiration: 86400000
  
  cache:
    redis:
      enabled: true
      ttl: 3600
```

```ini
# templates/spring-boot.service.j2
[Unit]
Description={{ app_name }} Spring Boot Application
After=network.target postgresql.service redis.service

[Service]
Type=simple
User={{ app_name }}
Group={{ app_name }}
ExecStart=/usr/bin/java \
    -Xms512m \
    -Xmx1024m \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:+UseStringDeduplication \
    -Dspring.profiles.active={{ spring_profiles_active | default('production') }} \
    -Dspring.config.location=/opt/{{ app_name }}/config/application.yml \
    -jar /opt/{{ app_name }}/{{ app_name }}.jar

ExecStop=/bin/kill -TERM $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier={{ app_name }}

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/{{ app_name }}/logs

# Resource limits
LimitNOFILE=65536
LimitMEMLOCK=infinity

[Install]
WantedBy=multi-user.target
```

## Kubernetes ile Container Orchestration

Modern uygulamalar için Kubernetes tabanlı deployment daha yaygın hale gelmiştir.

### Helm Chart Structure

```yaml
# Chart.yaml
apiVersion: v2
name: spring-boot-app
description: A Helm chart for Spring Boot application
version: 0.1.0
appVersion: "1.0.0"

dependencies:
  - name: postgresql
    version: 12.1.9
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  
  - name: redis
    version: 17.3.7
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

```yaml
# values.yaml
# Default values for spring-boot-app

replicaCount: 3

image:
  repository: your-registry/spring-boot-app
  pullPolicy: IfNotPresent
  tag: "latest"

nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext:
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000
  capabilities:
    drop:
    - ALL

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  className: "nginx"
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: api-tls
      hosts:
        - api.yourcompany.com

resources:
  limits:
    cpu: 1000m
    memory: 1024Mi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values:
            - spring-boot-app
        topologyKey: kubernetes.io/hostname

# Application specific configuration
app:
  environment: production
  logLevel: INFO
  
  database:
    host: postgresql
    port: 5432
    name: appdb
    username: appuser
    
  redis:
    host: redis-master
    port: 6379

# PostgreSQL configuration
postgresql:
  enabled: true
  auth:
    postgresPassword: "postgres123"
    username: "appuser"
    password: "apppass123"
    database: "appdb"
  
  primary:
    persistence:
      enabled: true
      size: 20Gi
      storageClass: "gp2"

# Redis configuration
redis:
  enabled: true
  auth:
    enabled: true
    password: "redis123"
  
  master:
    persistence:
      enabled: true
      size: 8Gi
      storageClass: "gp2"
```

### Kubernetes Manifests

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "spring-boot-app.fullname" . }}
  labels:
    {{- include "spring-boot-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "spring-boot-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "spring-boot-app.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "spring-boot-app.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: {{ .Values.app.environment }}
            - name: SPRING_DATASOURCE_URL
              value: "jdbc:postgresql://{{ .Values.app.database.host }}:{{ .Values.app.database.port }}/{{ .Values.app.database.name }}"
            - name: SPRING_DATASOURCE_USERNAME
              value: {{ .Values.app.database.username }}
            - name: SPRING_DATASOURCE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "spring-boot-app.fullname" . }}-secret
                  key: database-password
            - name: SPRING_REDIS_HOST
              value: {{ .Values.app.redis.host }}
            - name: SPRING_REDIS_PORT
              value: "{{ .Values.app.redis.port }}"
            - name: SPRING_REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "spring-boot-app.fullname" . }}-secret
                  key: redis-password
            - name: LOGGING_LEVEL_ROOT
              value: {{ .Values.app.logLevel }}
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: http
            initialDelaySeconds: 60
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: logs
              mountPath: /app/logs
      volumes:
        - name: tmp
          emptyDir: {}
        - name: logs
          emptyDir: {}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

```yaml
# templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "spring-boot-app.fullname" . }}-config
  labels:
    {{- include "spring-boot-app.labels" . | nindent 4 }}
data:
  application.yml: |
    spring:
      datasource:
        url: ${SPRING_DATASOURCE_URL}
        username: ${SPRING_DATASOURCE_USERNAME}
        password: ${SPRING_DATASOURCE_PASSWORD}
        driver-class-name: org.postgresql.Driver
        hikari:
          maximum-pool-size: 20
          minimum-idle: 5
          connection-timeout: 30000
      
      jpa:
        hibernate:
          ddl-auto: validate
        properties:
          hibernate:
            dialect: org.hibernate.dialect.PostgreSQLDialect
      
      redis:
        host: ${SPRING_REDIS_HOST}
        port: ${SPRING_REDIS_PORT}
        password: ${SPRING_REDIS_PASSWORD}
        lettuce:
          pool:
            max-active: 20
    
    management:
      endpoints:
        web:
          exposure:
            include: health,info,metrics,prometheus
      endpoint:
        health:
          show-details: always
          probes:
            enabled: true
    
    logging:
      level:
        root: ${LOGGING_LEVEL_ROOT}
        com.yourcompany: DEBUG
      pattern:
        console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
```

## CI/CD Pipeline Entegrasyonu

### GitLab CI/CD Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - security
  - package
  - infrastructure
  - deploy
  - verify

variables:
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"
  MAVEN_CLI_OPTS: "--batch-mode --errors --fail-at-end --show-version"
  DOCKER_TLS_CERTDIR: "/certs"
  TF_ROOT: ${CI_PROJECT_DIR}/infrastructure
  TF_ADDRESS: ${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/terraform/state/default

cache:
  paths:
    - .m2/repository/
    - target/

build:
  stage: build
  image: maven:3.8.6-openjdk-17
  script:
    - mvn $MAVEN_CLI_OPTS compile
  artifacts:
    paths:
      - target/
    expire_in: 1 hour

test:
  stage: test
  image: maven:3.8.6-openjdk-17
  services:
    - postgres:15
    - redis:7-alpine
  variables:
    POSTGRES_DB: testdb
    POSTGRES_USER: testuser
    POSTGRES_PASSWORD: testpass
    SPRING_PROFILES_ACTIVE: test
    SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/testdb
    SPRING_DATASOURCE_USERNAME: testuser
    SPRING_DATASOURCE_PASSWORD: testpass
    SPRING_REDIS_HOST: redis
  script:
    - mvn $MAVEN_CLI_OPTS test
  artifacts:
    reports:
      junit:
        - target/surefire-reports/TEST-*.xml
        - target/failsafe-reports/TEST-*.xml
    paths:
      - target/site/jacoco/
  coverage: '/Total.*?([0-9]{1,3})%/'

security_scan:
  stage: security
  image: owasp/dependency-check:latest
  script:
    - /usr/share/dependency-check/bin/dependency-check.sh 
      --project "$CI_PROJECT_NAME" 
      --scan target/
      --format XML 
      --format JSON 
      --format HTML
  artifacts:
    reports:
      dependency_scanning: dependency-check-report.json
    paths:
      - dependency-check-report.*

package:
  stage: package
  image: maven:3.8.6-openjdk-17
  services:
    - docker:20.10.16-dind
  before_script:
    - echo $CI_REGISTRY_PASSWORD | docker login -u $CI_REGISTRY_USER --password-stdin $CI_REGISTRY
  script:
    - mvn $MAVEN_CLI_OPTS package -DskipTests
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker build -t $CI_REGISTRY_IMAGE:latest .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
  artifacts:
    paths:
      - target/*.jar

terraform_plan:
  stage: infrastructure
  image: hashicorp/terraform:1.6
  before_script:
    - cd $TF_ROOT
    - terraform init
      -backend-config="address=${TF_ADDRESS}"
      -backend-config="lock_address=${TF_ADDRESS}/lock"
      -backend-config="unlock_address=${TF_ADDRESS}/lock"
      -backend-config="username=gitlab-ci-token"
      -backend-config="password=${CI_JOB_TOKEN}"
      -backend-config="lock_method=POST"
      -backend-config="unlock_method=DELETE"
      -backend-config="retry_wait_min=5"
  script:
    - terraform plan -var="app_version=$CI_COMMIT_SHA" -out=plan.tfplan
    - terraform show -json plan.tfplan > plan.json
  artifacts:
    paths:
      - $TF_ROOT/plan.tfplan
      - $TF_ROOT/plan.json
    expire_in: 1 week
  only:
    - merge_requests
    - main

terraform_apply:
  stage: infrastructure
  image: hashicorp/terraform:1.6
  before_script:
    - cd $TF_ROOT
    - terraform init
      -backend-config="address=${TF_ADDRESS}"
      -backend-config="lock_address=${TF_ADDRESS}/lock"
      -backend-config="unlock_address=${TF_ADDRESS}/lock"
      -backend-config="username=gitlab-ci-token"
      -backend-config="password=${CI_JOB_TOKEN}"
      -backend-config="lock_method=POST"
      -backend-config="unlock_method=DELETE"
      -backend-config="retry_wait_min=5"
  script:
    - terraform apply -var="app_version=$CI_COMMIT_SHA" -auto-approve
  dependencies:
    - terraform_plan
  only:
    - main
  when: manual

deploy_staging:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: https://staging-api.yourcompany.com
  before_script:
    - kubectl config use-context staging
  script:
    - helm upgrade --install staging-app ./helm-chart
      --namespace staging
      --create-namespace
      --set image.tag=$CI_COMMIT_SHA
      --set ingress.hosts[0].host=staging-api.yourcompany.com
      --set app.environment=staging
      --wait --timeout=10m
  only:
    - main

deploy_production:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://api.yourcompany.com
  before_script:
    - kubectl config use-context production
  script:
    - helm upgrade --install prod-app ./helm-chart
      --namespace production
      --create-namespace
      --set image.tag=$CI_COMMIT_SHA
      --set ingress.hosts[0].host=api.yourcompany.com
      --set app.environment=production
      --set replicaCount=5
      --wait --timeout=15m
  only:
    - main
  when: manual

health_check:
  stage: verify
  image: curlimages/curl:latest
  script:
    - sleep 30  # Wait for deployment to stabilize
    - |
      for i in {1..10}; do
        if curl -f https://api.yourcompany.com/actuator/health; then
          echo "Health check passed"
          exit 0
        fi
        echo "Health check failed, attempt $i/10"
        sleep 30
      done
      echo "Health check failed after 10 attempts"
      exit 1
  only:
    - main
  dependencies:
    - deploy_production
```

IaC, modern yazılım geliştirme süreçlerinin ayrılmaz bir parçasıdır. Terraform, Ansible ve Kubernetes gibi araçlarla birlikte kullanıldığında güçlü, ölçeklenebilir ve güvenilir altyapı yönetimi sağlar.
