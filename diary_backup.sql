--
-- PostgreSQL database cluster dump
--


CREATE TABLE public.entries (
    id integer NOT NULL,
    user_id integer,
    title character varying(255),
    content text,
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(255),
    images text[],
    layout jsonb
);


ALTER TABLE public.entries OWNER TO admin;

--
-- Name: entries_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entries_id_seq OWNER TO admin;

--
-- Name: entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.entries_id_seq OWNED BY public.entries.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    full_name character varying(255),
    birthdate date,
    gender character varying(20),
    country character varying(100),
    facebook_link text,
    gmail_link text,
    apple_id_link text,
    x_link text,
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO admin;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO admin;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: entries id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.entries ALTER COLUMN id SET DEFAULT nextval('public.entries_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: entries; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.entries (id, user_id, title, content, created_date, created_by, images) FROM stdin;
20	1	sssss	sqsqsqsq	2026-03-14 06:43:30.247311	Watchara	{"/uploads/1773470610225877000-LINE_ALBUM_Countdown HSPrep_260310_2.jpg"}
21	1	dwdwd	wdwdwdw	2026-03-14 06:44:16.274738	Watchara	{/uploads/1773470653113775000-5404ad1fb70a0e1a14eba5bb62960adb.MP4}
1	1	บันทึกของฉัน	วันนี้ไปทำงานที่ HomePro สนุกมาก	2026-03-10 14:59:07.848	\N	\N
2	1	อีกวันที่สนุก	Happy ok	2026-03-11 00:35:59.772	\N	\N
3	1	Test diary	Test ฮ๋าๆ ฮ่าๆ	2026-03-12 14:10:50.624	\N	\N
4	1	ฮ๋าฮ๋ษฮ๋ษ	ฮ่าอ่าอ่าอ	2026-03-12 14:11:04.339	\N	\N
5	1	Test Pic	Test	2026-03-12 14:37:27.568012	Admin	{/uploads/1773326247548204000-K2-book1.jpg,"/uploads/1773326247549639000-LINE_ALBUM_Countdown HSPrep_260311_2.jpg",/uploads/1773326247551717000-K3-Book2.jpg,/uploads/1773326247553027000-K3-Closths.jpg}
6	1	บันทึกของฉัน	วันนี้ไปทำงานที่ HomePro สนุกมาก	2026-03-10 14:59:07.848	\N	\N
7	1	อีกวันที่สนุก	Happy ok	2026-03-11 00:35:59.772	\N	\N
8	1	Test diary	Test ฮ๋าๆ ฮ่าๆ	2026-03-12 14:10:50.624	\N	\N
9	1	ฮ๋าฮ๋ษฮ๋ษ	ฮ่าอ่าอ่าอ	2026-03-12 14:11:04.339	\N	\N
10	1	Test Pic	Test	2026-03-12 14:37:27.568012	Admin	{/uploads/1773326247548204000-K2-book1.jpg,"/uploads/1773326247549639000-LINE_ALBUM_Countdown HSPrep_260311_2.jpg",/uploads/1773326247551717000-K3-Book2.jpg,/uploads/1773326247553027000-K3-Closths.jpg}
11	1	Test Pic	Test	2026-03-12 14:37:27.568012	Admin	{/uploads/1773326247548204000-K2-book1.jpg,"/uploads/1773326247549639000-LINE_ALBUM_Countdown HSPrep_260311_2.jpg",/uploads/1773326247551717000-K3-Book2.jpg,/uploads/1773326247553027000-K3-Closths.jpg}
12	1	Test Pic	Test	2026-03-12 14:37:27.568012	Admin	{/uploads/1773326247548204000-K2-book1.jpg,"/uploads/1773326247549639000-LINE_ALBUM_Countdown HSPrep_260311_2.jpg",/uploads/1773326247551717000-K3-Book2.jpg,/uploads/1773326247553027000-K3-Closths.jpg}
13	1	บันทึกของฉัน	วันนี้ไปทำงานที่ HomePro สนุกมาก	2026-03-10 14:59:07.848	\N	\N
14	1	อีกวันที่สนุก	Happy ok	2026-03-11 00:35:59.772	\N	\N
15	1	Test diary	Test ฮ๋าๆ ฮ่าๆ	2026-03-12 14:10:50.624	\N	\N
16	1	ฮ๋าฮ๋ษฮ๋ษ	ฮ่าอ่าอ่าอ	2026-03-12 14:11:04.339	\N	\N
19	1	Test Pic	Test	2026-03-12 14:37:27.568012	Admin	{/uploads/1773326247548204000-K2-book1.jpg,"/uploads/1773326247549639000-LINE_ALBUM_Countdown HSPrep_260311_2.jpg",/uploads/1773326247551717000-K3-Book2.jpg,/uploads/1773326247553027000-K3-Closths.jpg}
22	1	ทดสอบ	ทดสอบ	2026-03-15 13:25:03.462944	Watchara	{}
23	1	dwdwd	dwdwdw	2026-03-15 14:37:00.282147	Watchara	{}
24	1	กกกก	กกกกก	2026-03-15 14:37:34.992463	Watchara	{}
27	1	dwdwdw	dwdwdwdwdw	2026-03-15 15:22:37.556697	Watchara	{https://res.cloudinary.com/dsk0kjgsl/image/upload/v1773588156/my_diary_app/lxhqv0d4da6ifn532iw5.jpg}
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.users (id, username, password, full_name, birthdate, gender, country, facebook_link, gmail_link, apple_id_link, x_link, created_date) FROM stdin;
1	boy	$2a$10$xsQ.IRS7JG/2Ue3uWxqqJuQhXWntHTK6XUk9qkn4mVnSmYnc7infC	Watchara	1983-06-25	male	Thailand					2026-03-15 08:51:53.384135
\.


--
-- Name: entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.entries_id_seq', 27, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- PostgreSQL database dump complete
--

\unrestrict XfgCjLI6qE1cwHo4up8BZ9fbla1wvy9AvMrZawLN3AMdqV4AdinVELqYI9z2Fds

--
-- Database "postgres" dump
--

--
-- PostgreSQL database dump
--

\restrict KfiAX8Q1gJSo3YZaTGM7yJ667rG3Aigep0S7gf8tTR3WrSUY1fyCFaaRpYY9H6c

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE postgres;
--
-- Name: postgres; Type: DATABASE; Schema: -; Owner: admin
--

CREATE DATABASE postgres WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE postgres OWNER TO admin;

\unrestrict KfiAX8Q1gJSo3YZaTGM7yJ667rG3Aigep0S7gf8tTR3WrSUY1fyCFaaRpYY9H6c
\connect postgres
\restrict KfiAX8Q1gJSo3YZaTGM7yJ667rG3Aigep0S7gf8tTR3WrSUY1fyCFaaRpYY9H6c

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE postgres; Type: COMMENT; Schema: -; Owner: admin
--

COMMENT ON DATABASE postgres IS 'default administrative connection database';


--
-- PostgreSQL database dump complete
--

\unrestrict KfiAX8Q1gJSo3YZaTGM7yJ667rG3Aigep0S7gf8tTR3WrSUY1fyCFaaRpYY9H6c

--
-- PostgreSQL database cluster dump complete
--

