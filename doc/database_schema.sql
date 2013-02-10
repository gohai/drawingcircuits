SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;


CREATE TABLE IF NOT EXISTS `boards` (
  `board` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `owner` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`board`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `comments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `part` varchar(255) NOT NULL,
  `comment` text NOT NULL,
  `added` datetime NOT NULL,
  `author` int(10) unsigned DEFAULT NULL,
  `host` varchar(255) NOT NULL,
  `visible` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `part` (`part`),
  KEY `visible` (`visible`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `layers` (
  `board` int(10) unsigned NOT NULL,
  `rev` int(10) unsigned NOT NULL,
  `layer` varchar(255) NOT NULL,
  `width` smallint(5) unsigned NOT NULL,
  `height` smallint(5) unsigned NOT NULL,
  `png` longblob,
  PRIMARY KEY (`board`,`rev`,`layer`),
  KEY `board` (`board`,`rev`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `parts` (
  `part` varchar(255) NOT NULL,
  `rev` int(10) unsigned NOT NULL DEFAULT '1',
  `title` varchar(255) DEFAULT NULL,
  `parent` varchar(255) DEFAULT NULL,
  `svg` text,
  `json` text NOT NULL,
  `added` datetime NOT NULL,
  `author` int(10) unsigned DEFAULT NULL,
  `host` varchar(255) NOT NULL,
  `originalSvg` text,
  `visible` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`part`,`rev`),
  KEY `part` (`part`),
  KEY `visible` (`visible`),
  KEY `title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `revisions` (
  `board` int(10) unsigned NOT NULL,
  `rev` int(10) unsigned NOT NULL DEFAULT '1',
  `created` datetime NOT NULL,
  `author` int(10) unsigned DEFAULT NULL,
  `host` varchar(255) NOT NULL,
  `parentBoard` int(10) unsigned DEFAULT NULL,
  `parentRev` int(10) unsigned DEFAULT NULL,
  `isPattern` tinyint(1) NOT NULL,
  `json` text NOT NULL,
  PRIMARY KEY (`board`,`rev`),
  KEY `created` (`created`,`author`),
  KEY `uid` (`author`),
  KEY `isPattern` (`isPattern`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `part` varchar(255) NOT NULL,
  `supplier` varchar(255) NOT NULL,
  `partNumber` varchar(255) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `added` datetime NOT NULL,
  `addedBy` int(10) unsigned DEFAULT NULL,
  `host` varchar(255) NOT NULL,
  `visible` tinyint(1) NOT NULL DEFAULT '0',
  UNIQUE KEY `supplier` (`part`,`supplier`,`partNumber`,`url`),
  KEY `part` (`part`),
  KEY `visible` (`visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `users` (
  `uid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `salt` varchar(32) NOT NULL,
  `secret` varchar(32) NOT NULL,
  `role` tinyint(3) unsigned NOT NULL DEFAULT '1',
  `firstLogin` datetime NOT NULL,
  `firstHost` varchar(255) NOT NULL,
  `lastLogin` datetime NOT NULL,
  `lastHost` varchar(255) NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `user` (`user`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
