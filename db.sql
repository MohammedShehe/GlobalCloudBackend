-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: gcloud
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `document_shares`
--

DROP TABLE IF EXISTS `document_shares`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_shares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `document_id` int(11) NOT NULL,
  `shared_with` int(11) NOT NULL,
  `shared_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  KEY `shared_with` (`shared_with`),
  CONSTRAINT `document_shares_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_shares_ibfk_2` FOREIGN KEY (`shared_with`) REFERENCES `family_members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_shares`
--

LOCK TABLES `document_shares` WRITE;
/*!40000 ALTER TABLE `document_shares` DISABLE KEYS */;
INSERT INTO `document_shares` VALUES (1,3,2,'2026-03-09 11:09:07');
/*!40000 ALTER TABLE `document_shares` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_id` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` enum('pdf','word','excel') NOT NULL,
  `description` text DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `family_id` (`family_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `family_members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (2,3,4,'Family Budget 2026','M:\\FlutterProjects\\gcloudBackend\\uploads\\1773052631055-736498761-Excel Day - I.xlsx','excel','Budget Planning for 2026','budget, finance','2026-03-09 10:37:11'),(3,8,13,'Family Budget 2026','M:\\FlutterProjects\\gcloudBackend\\uploads\\1773054341771-729698233-DUA KWAAJILI YA MUNDHIR.docx','word','Budget Planning for 2026','budget, finance','2026-03-09 11:05:41');
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `families`
--

DROP TABLE IF EXISTS `families`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `families` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_name` varchar(255) NOT NULL,
  `family_password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_family_name` (`family_name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `families`
--

LOCK TABLES `families` WRITE;
/*!40000 ALTER TABLE `families` DISABLE KEYS */;
INSERT INTO `families` VALUES (1,'four brothers','$2b$10$pwsH1QajAvggTsNm2JZ61eFYt4kVXagaA5ewlYxNp2KCa6j4fx1Zy','2026-03-09 09:34:53'),(3,'four brothers2','$2b$10$CMOhnvuOUbm6v8xM/0KnGeZdHgC93idCz4bfoOWMUka.tTcpN8YkK','2026-03-09 09:35:38'),(4,'hassanfamily','$2b$10$qcSgbLkBkkSKvy6qCtNpx.GAlSlCOSht3fHMwNm4CenM3yqeLpi8m','2026-03-09 10:44:46'),(6,'hassanfamily2','$2b$10$rHOM6rsGrPp8VTBT3.l64OcG5KyEQRSp96d09Qaj4Zv0Vi5Db97oK','2026-03-09 10:51:18'),(7,'hassan','$2b$10$h9KxXX3S5pyHabo1s3Yz8ukMpIp1crigRcJlT1uNL06rVIVXqnPgm','2026-03-09 10:54:38'),(8,'smith','$2b$10$Z/a44cuVlcZ0H1lxIEBDRuBnRrNQWd2btUr.PYPwta8vn1pYhbOJu','2026-03-09 11:02:31'),(9,'smith family','$2b$10$LhJlV86O1PAVEn85oZ5yXOj.WZhnunH.vtCEA5bqCokFdwoGGpDP2','2026-03-27 09:19:00');
/*!40000 ALTER TABLE `families` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `family_members`
--

DROP TABLE IF EXISTS `family_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `family_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_id` int(11) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `second_name` varchar(100) NOT NULL,
  `third_name` varchar(100) NOT NULL,
  `role` enum('admin','member') NOT NULL DEFAULT 'member',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_family_member` (`family_id`,`first_name`,`second_name`,`third_name`),
  KEY `fk_family_idx` (`family_id`),
  CONSTRAINT `fk_family` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `family_members`
--

LOCK TABLES `family_members` WRITE;
/*!40000 ALTER TABLE `family_members` DISABLE KEYS */;
INSERT INTO `family_members` VALUES (1,1,'Ali','Hassan','Said','member','2026-03-09 09:34:53'),(2,1,'Omar','Hassan','Said','admin','2026-03-09 09:34:53'),(3,1,'Yusuf','Hassan','Said','member','2026-03-09 09:34:53'),(4,3,'Ali','Hassan','Said','admin','2026-03-09 09:35:38'),(5,4,'Ali','Hassan','Said','admin','2026-03-09 10:44:46'),(6,4,'Omar','Hassan','Said','member','2026-03-09 10:44:46'),(7,4,'Yusuf','Hassan','Said','member','2026-03-09 10:44:46'),(8,6,'Ali','Hassan','Said','admin','2026-03-09 10:51:18'),(9,6,'Omar','Hassan','Said','member','2026-03-09 10:51:18'),(10,6,'Yusuf','Hassan','Said','member','2026-03-09 10:51:18'),(11,7,'Ali','Hassan','Said','admin','2026-03-09 10:54:38'),(12,7,'Omar','Hassan','Said','member','2026-03-09 10:54:38'),(13,8,'John','Michael','Smith','admin','2026-03-09 11:02:31'),(14,8,'Jane','Alice','Smith','member','2026-03-09 11:02:31'),(15,9,'John','Michael','Smith','admin','2026-03-27 09:19:01'),(16,9,'Jane','Alice','Smith','member','2026-03-27 09:19:01'),(17,9,'Bob','William','Smith','member','2026-03-27 09:19:01');
/*!40000 ALTER TABLE `family_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `photo_share_links`
--

DROP TABLE IF EXISTS `photo_share_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photo_share_links` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `photo_id` int(11) NOT NULL,
  `share_token` varchar(255) NOT NULL,
  `created_by` int(11) NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_token` (`share_token`),
  KEY `photo_id` (`photo_id`),
  CONSTRAINT `photo_share_links_ibfk_1` FOREIGN KEY (`photo_id`) REFERENCES `photos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `photo_share_links`
--

LOCK TABLES `photo_share_links` WRITE;
/*!40000 ALTER TABLE `photo_share_links` DISABLE KEYS */;
INSERT INTO `photo_share_links` VALUES (1,1,'751f5bed6d7bd16fda4d2b5ce45a0a877460c6a508cdf1eb896c0da048e30148',15,'2026-03-28 09:30:22','2026-03-27 09:30:22');
/*!40000 ALTER TABLE `photo_share_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `photo_shares`
--

DROP TABLE IF EXISTS `photo_shares`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photo_shares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `photo_id` int(11) NOT NULL,
  `shared_with` int(11) NOT NULL,
  `shared_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `photo_id` (`photo_id`),
  KEY `shared_with` (`shared_with`),
  CONSTRAINT `photo_shares_ibfk_1` FOREIGN KEY (`photo_id`) REFERENCES `photos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `photo_shares_ibfk_2` FOREIGN KEY (`shared_with`) REFERENCES `family_members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `photo_shares`
--

LOCK TABLES `photo_shares` WRITE;
/*!40000 ALTER TABLE `photo_shares` DISABLE KEYS */;
/*!40000 ALTER TABLE `photo_shares` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `photos`
--

DROP TABLE IF EXISTS `photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `family_id` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `photo_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `family_id` (`family_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `photos_ibfk_1` FOREIGN KEY (`family_id`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `photos_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `family_members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `photos`
--

LOCK TABLES `photos` WRITE;
/*!40000 ALTER TABLE `photos` DISABLE KEYS */;
INSERT INTO `photos` VALUES (1,9,15,'lpu-campus.jpg','M:\\FlutterProjects\\gcloudBackend\\uploads\\photos\\1774603356901-846204780.jpg',773886,'Testing','test','2026-03-27 09:22:37'),(2,9,15,'Screenshot 2025-09-15 161841.png','M:\\FlutterProjects\\gcloudBackend\\uploads\\photos\\1774603403511-47200254.png',381270,'Testing','test','2026-03-27 09:23:23'),(3,9,15,'Screenshot 2025-09-15 161841.png','M:\\FlutterProjects\\gcloudBackend\\uploads\\photos\\1774603508983-206470050.png',381270,'Testing','test','2026-03-27 09:25:09'),(4,9,15,'LPU.jpg','M:\\FlutterProjects\\gcloudBackend\\uploads\\photos\\1774603508994-982965794.jpg',246784,'Testing','test','2026-03-27 09:25:09');
/*!40000 ALTER TABLE `photos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-27 12:34:00
