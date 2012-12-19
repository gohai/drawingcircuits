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
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1 ;

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

CREATE TABLE IF NOT EXISTS `revisions` (
  `board` int(10) unsigned NOT NULL,
  `rev` int(10) unsigned NOT NULL,
  `created` datetime NOT NULL,
  `author` int(10) unsigned DEFAULT NULL,
  `host` varchar(15) NOT NULL,
  `parentBoard` int(10) unsigned DEFAULT NULL,
  `parentRev` int(10) unsigned DEFAULT NULL,
  `json` text NOT NULL,
  PRIMARY KEY (`board`,`rev`),
  KEY `created` (`created`,`author`),
  KEY `uid` (`author`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `users` (
  `uid` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `secret` varchar(32) NOT NULL,
  `role` tinyint(3) unsigned NOT NULL DEFAULT '0',
  `first_login` datetime NOT NULL,
  `last_login` datetime NOT NULL,
  PRIMARY KEY (`uid`),
  KEY `user` (`user`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=2 ;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
