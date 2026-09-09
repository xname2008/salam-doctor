--
-- PostgreSQL database dump
--

\restrict HrPeJh5HxXCxpXraTpIUEkClgIsys3aF27PDPptSaywTeA08r8IXbp0Kq2vMfOm

-- Dumped from database version 18.4 (Ubuntu 18.4-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: salam_doctor
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO salam_doctor;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: salam_doctor
--

COMMENT ON SCHEMA public IS '';


--
-- Name: ContractStatus; Type: TYPE; Schema: public; Owner: salam_doctor
--

CREATE TYPE public."ContractStatus" AS ENUM (
    'ACTIVE',
    'EXPIRED'
);


ALTER TYPE public."ContractStatus" OWNER TO salam_doctor;

--
-- Name: DeviceType; Type: TYPE; Schema: public; Owner: salam_doctor
--

CREATE TYPE public."DeviceType" AS ENUM (
    'LASER',
    'HIFU',
    'ENDOLIFT',
    'OTHER'
);


ALTER TYPE public."DeviceType" OWNER TO salam_doctor;

--
-- Name: VerificationStatus; Type: TYPE; Schema: public; Owner: salam_doctor
--

CREATE TYPE public."VerificationStatus" AS ENUM (
    'PENDING',
    'APPROVED'
);


ALTER TYPE public."VerificationStatus" OWNER TO salam_doctor;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: salam_doctor
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO salam_doctor;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO salam_doctor;

--
-- Name: articles; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public.articles (
    id integer NOT NULL,
    slug character varying(220) NOT NULL,
    title character varying(300) NOT NULL,
    meta_description character varying(320),
    content text NOT NULL,
    featured_image_url character varying(500),
    author_name character varying(160) DEFAULT 'تیم سلام دکتر'::character varying NOT NULL,
    author_credentials character varying(400),
    related_service_slug character varying(220),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.articles OWNER TO salam_doctor;

--
-- Name: articles_id_seq; Type: SEQUENCE; Schema: public; Owner: salam_doctor
--

CREATE SEQUENCE public.articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.articles_id_seq OWNER TO salam_doctor;

--
-- Name: articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: salam_doctor
--

ALTER SEQUENCE public.articles_id_seq OWNED BY public.articles.id;


--
-- Name: clinic_devices; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public.clinic_devices (
    id integer NOT NULL,
    clinic_id integer NOT NULL,
    device_id integer NOT NULL,
    is_authentic_badge boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.clinic_devices OWNER TO salam_doctor;

--
-- Name: clinic_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: salam_doctor
--

CREATE SEQUENCE public.clinic_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clinic_devices_id_seq OWNER TO salam_doctor;

--
-- Name: clinic_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: salam_doctor
--

ALTER SEQUENCE public.clinic_devices_id_seq OWNED BY public.clinic_devices.id;


--
-- Name: clinic_services; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public.clinic_services (
    id integer NOT NULL,
    clinic_id integer NOT NULL,
    service_id integer NOT NULL,
    custom_price numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.clinic_services OWNER TO salam_doctor;

--
-- Name: clinic_services_id_seq; Type: SEQUENCE; Schema: public; Owner: salam_doctor
--

CREATE SEQUENCE public.clinic_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clinic_services_id_seq OWNER TO salam_doctor;

--
-- Name: clinic_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: salam_doctor
--

ALTER SEQUENCE public.clinic_services_id_seq OWNED BY public.clinic_services.id;


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public.clinics (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    license_number character varying(80) NOT NULL,
    phone character varying(40) NOT NULL,
    biography text,
    full_address text NOT NULL,
    latitude numeric(9,6),
    longitude numeric(9,6),
    contract_status public."ContractStatus" DEFAULT 'ACTIVE'::public."ContractStatus" NOT NULL,
    contract_duration_months integer DEFAULT 14 NOT NULL,
    start_date date,
    end_date date,
    has_dedicated_website boolean DEFAULT false NOT NULL,
    dedicated_domain character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    district_id integer,
    dept1_title character varying(200),
    dept1_phone character varying(40),
    dept1_whatsapp character varying(40),
    dept2_title character varying(200),
    dept2_phone character varying(40),
    dept2_whatsapp character varying(40),
    rubika_title character varying(120),
    rubika_link character varying(500),
    bale_title character varying(120),
    bale_link character varying(500)
);


ALTER TABLE public.clinics OWNER TO salam_doctor;

--
-- Name: clinics_id_seq; Type: SEQUENCE; Schema: public; Owner: salam_doctor
--

CREATE SEQUENCE public.clinics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clinics_id_seq OWNER TO salam_doctor;

--
-- Name: clinics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: salam_doctor
--

ALTER SEQUENCE public.clinics_id_seq OWNED BY public.clinics.id;


--
-- Name: districts; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public.districts (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(140) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.districts OWNER TO salam_doctor;

--
-- Name: districts_id_seq; Type: SEQUENCE; Schema: public; Owner: salam_doctor
--

CREATE SEQUENCE public.districts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.districts_id_seq OWNER TO salam_doctor;

--
-- Name: districts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: salam_doctor
--

ALTER SEQUENCE public.districts_id_seq OWNED BY public.districts.id;


--
-- Name: medical_devices; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public.medical_devices (
    id integer NOT NULL,
    brand_name character varying(150) NOT NULL,
    device_type public."DeviceType" NOT NULL,
    verification_status public."VerificationStatus" DEFAULT 'PENDING'::public."VerificationStatus" NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.medical_devices OWNER TO salam_doctor;

--
-- Name: medical_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: salam_doctor
--

CREATE SEQUENCE public.medical_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.medical_devices_id_seq OWNER TO salam_doctor;

--
-- Name: medical_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: salam_doctor
--

ALTER SEQUENCE public.medical_devices_id_seq OWNED BY public.medical_devices.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: salam_doctor
--

CREATE TABLE public.services (
    id integer NOT NULL,
    parent_id integer,
    service_name character varying(200) NOT NULL,
    slug character varying(220) NOT NULL,
    base_price numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.services OWNER TO salam_doctor;

--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: salam_doctor
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.services_id_seq OWNER TO salam_doctor;

--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: salam_doctor
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: articles id; Type: DEFAULT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.articles ALTER COLUMN id SET DEFAULT nextval('public.articles_id_seq'::regclass);


--
-- Name: clinic_devices id; Type: DEFAULT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_devices ALTER COLUMN id SET DEFAULT nextval('public.clinic_devices_id_seq'::regclass);


--
-- Name: clinic_services id; Type: DEFAULT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_services ALTER COLUMN id SET DEFAULT nextval('public.clinic_services_id_seq'::regclass);


--
-- Name: clinics id; Type: DEFAULT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinics ALTER COLUMN id SET DEFAULT nextval('public.clinics_id_seq'::regclass);


--
-- Name: districts id; Type: DEFAULT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.districts ALTER COLUMN id SET DEFAULT nextval('public.districts_id_seq'::regclass);


--
-- Name: medical_devices id; Type: DEFAULT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.medical_devices ALTER COLUMN id SET DEFAULT nextval('public.medical_devices_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
7fa72348-421d-4675-b9bc-4bb3081cf10e	c18bc7adc70709ce971fa8df842c0cce143ad4d2c39f24fd0cc493ff07539728	2026-07-14 16:47:49.691531+03:30	0001_init	\N	\N	2026-07-14 16:47:49.449993+03:30	1
58f0d2e3-c3f8-47da-827b-e0e3897b8201	b900af0b1a0e057daadf69d98788f26a55db399cffb6c1661e634e9330075366	2026-07-21 16:15:44.225062+03:30	20260721120000_add_blog_articles	\N	\N	2026-07-21 16:15:43.959925+03:30	1
e494251e-3dc4-4e34-977b-8b4a4b85aa74	fe972ade903b1c250acbd3f071f7991e1dc1c66579f109ee75f9c7efb2ffdf3c	2026-07-23 16:16:20.718727+03:30	20260723143000_add_clinic_department_contacts	\N	\N	2026-07-23 16:16:20.675714+03:30	1
2bb30755-c31c-4e64-a8cc-1c858aa65e2f	1a75f43412db92c44c4d23d309c29d5dac420fe82661b88e691f9a06974d80fe	2026-07-28 12:35:01.544036+03:30	20260727190000_add_clinic_rubika_bale_links	\N	\N	2026-07-28 12:35:01.421323+03:30	1
\.


--
-- Data for Name: articles; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public.articles (id, slug, title, meta_description, content, featured_image_url, author_name, author_credentials, related_service_slug, created_at) FROM stdin;
\.


--
-- Data for Name: clinic_devices; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public.clinic_devices (id, clinic_id, device_id, is_authentic_badge, created_at) FROM stdin;
\.


--
-- Data for Name: clinic_services; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public.clinic_services (id, clinic_id, service_id, custom_price, created_at) FROM stdin;
\.


--
-- Data for Name: clinics; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public.clinics (id, name, license_number, phone, biography, full_address, latitude, longitude, contract_status, contract_duration_months, start_date, end_date, has_dedicated_website, dedicated_domain, created_at, updated_at, district_id, dept1_title, dept1_phone, dept1_whatsapp, dept2_title, dept2_phone, dept2_whatsapp, rubika_title, rubika_link, bale_title, bale_link) FROM stdin;
\.


--
-- Data for Name: districts; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public.districts (id, name, slug, created_at) FROM stdin;
\.


--
-- Data for Name: medical_devices; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public.medical_devices (id, brand_name, device_type, verification_status, created_at) FROM stdin;
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: salam_doctor
--

COPY public.services (id, parent_id, service_name, slug, base_price, created_at) FROM stdin;
\.


--
-- Name: articles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: salam_doctor
--

SELECT pg_catalog.setval('public.articles_id_seq', 1, false);


--
-- Name: clinic_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: salam_doctor
--

SELECT pg_catalog.setval('public.clinic_devices_id_seq', 1, false);


--
-- Name: clinic_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: salam_doctor
--

SELECT pg_catalog.setval('public.clinic_services_id_seq', 1, false);


--
-- Name: clinics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: salam_doctor
--

SELECT pg_catalog.setval('public.clinics_id_seq', 1, false);


--
-- Name: districts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: salam_doctor
--

SELECT pg_catalog.setval('public.districts_id_seq', 1, false);


--
-- Name: medical_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: salam_doctor
--

SELECT pg_catalog.setval('public.medical_devices_id_seq', 1, false);


--
-- Name: services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: salam_doctor
--

SELECT pg_catalog.setval('public.services_id_seq', 1, false);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: clinic_devices clinic_devices_clinic_device_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_devices
    ADD CONSTRAINT clinic_devices_clinic_device_key UNIQUE (clinic_id, device_id);


--
-- Name: clinic_devices clinic_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_devices
    ADD CONSTRAINT clinic_devices_pkey PRIMARY KEY (id);


--
-- Name: clinic_services clinic_services_clinic_service_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_clinic_service_key UNIQUE (clinic_id, service_id);


--
-- Name: clinic_services clinic_services_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_pkey PRIMARY KEY (id);


--
-- Name: clinics clinics_dedicated_domain_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_dedicated_domain_key UNIQUE (dedicated_domain);


--
-- Name: clinics clinics_license_number_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_license_number_key UNIQUE (license_number);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);


--
-- Name: districts districts_name_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_name_key UNIQUE (name);


--
-- Name: districts districts_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_pkey PRIMARY KEY (id);


--
-- Name: districts districts_slug_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_slug_key UNIQUE (slug);


--
-- Name: medical_devices medical_devices_brand_type_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.medical_devices
    ADD CONSTRAINT medical_devices_brand_type_key UNIQUE (brand_name, device_type);


--
-- Name: medical_devices medical_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.medical_devices
    ADD CONSTRAINT medical_devices_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_slug_key; Type: CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_slug_key UNIQUE (slug);


--
-- Name: articles_created_at_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX articles_created_at_idx ON public.articles USING btree (created_at);


--
-- Name: articles_related_service_slug_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX articles_related_service_slug_idx ON public.articles USING btree (related_service_slug);


--
-- Name: articles_slug_key; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE UNIQUE INDEX articles_slug_key ON public.articles USING btree (slug);


--
-- Name: clinic_devices_clinic_id_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX clinic_devices_clinic_id_idx ON public.clinic_devices USING btree (clinic_id);


--
-- Name: clinic_devices_device_id_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX clinic_devices_device_id_idx ON public.clinic_devices USING btree (device_id);


--
-- Name: clinic_services_clinic_id_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX clinic_services_clinic_id_idx ON public.clinic_services USING btree (clinic_id);


--
-- Name: clinic_services_service_id_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX clinic_services_service_id_idx ON public.clinic_services USING btree (service_id);


--
-- Name: clinics_contract_status_end_date_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX clinics_contract_status_end_date_idx ON public.clinics USING btree (contract_status, end_date);


--
-- Name: clinics_contract_status_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX clinics_contract_status_idx ON public.clinics USING btree (contract_status);


--
-- Name: clinics_district_id_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX clinics_district_id_idx ON public.clinics USING btree (district_id);


--
-- Name: districts_slug_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX districts_slug_idx ON public.districts USING btree (slug);


--
-- Name: medical_devices_device_type_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX medical_devices_device_type_idx ON public.medical_devices USING btree (device_type);


--
-- Name: medical_devices_verification_status_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX medical_devices_verification_status_idx ON public.medical_devices USING btree (verification_status);


--
-- Name: services_parent_id_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX services_parent_id_idx ON public.services USING btree (parent_id);


--
-- Name: services_slug_idx; Type: INDEX; Schema: public; Owner: salam_doctor
--

CREATE INDEX services_slug_idx ON public.services USING btree (slug);


--
-- Name: clinics clinics_set_updated_at; Type: TRIGGER; Schema: public; Owner: salam_doctor
--

CREATE TRIGGER clinics_set_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clinic_devices clinic_devices_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_devices
    ADD CONSTRAINT clinic_devices_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clinic_devices clinic_devices_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_devices
    ADD CONSTRAINT clinic_devices_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.medical_devices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clinic_services clinic_services_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clinic_services clinic_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clinics clinics_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: services services_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: salam_doctor
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: salam_doctor
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict HrPeJh5HxXCxpXraTpIUEkClgIsys3aF27PDPptSaywTeA08r8IXbp0Kq2vMfOm

