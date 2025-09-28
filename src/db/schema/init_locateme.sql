--
-- PostgreSQL database dump
--

-- Dumped from database version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)
-- Dumped by pg_dump version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)

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

ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_person_id_fkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_default_device_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_device_access DROP CONSTRAINT IF EXISTS user_device_access_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_device_access DROP CONSTRAINT IF EXISTS user_device_access_device_id_fkey;
ALTER TABLE IF EXISTS ONLY public.positions DROP CONSTRAINT IF EXISTS positions_device_id_fkey1;
ALTER TABLE IF EXISTS ONLY public.people_in_groups DROP CONSTRAINT IF EXISTS people_in_groups_person_id_fkey;
ALTER TABLE IF EXISTS ONLY public.people_in_groups DROP CONSTRAINT IF EXISTS people_in_groups_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.devices DROP CONSTRAINT IF EXISTS devices_person_id_fkey;
ALTER TABLE IF EXISTS ONLY public.device_priority DROP CONSTRAINT IF EXISTS device_priority_device_id_fkey;
ALTER TABLE IF EXISTS ONLY public.device_notifications DROP CONSTRAINT IF EXISTS device_notifications_device_id_fkey;
DROP INDEX IF EXISTS public.idx_positions_timestamp_desc;
DROP INDEX IF EXISTS public.idx_positions_device_timestamp;
DROP INDEX IF EXISTS public.idx_devices_person_id;
DROP INDEX IF EXISTS public.idx_devices_active;
DROP INDEX IF EXISTS public."IDX_user_sessions_expire";
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_google_id_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.user_device_access DROP CONSTRAINT IF EXISTS user_device_access_pkey;
ALTER TABLE IF EXISTS ONLY public.positions DROP CONSTRAINT IF EXISTS positions_pkey1;
ALTER TABLE IF EXISTS ONLY public.people DROP CONSTRAINT IF EXISTS people_pkey;
ALTER TABLE IF EXISTS ONLY public.people_in_groups DROP CONSTRAINT IF EXISTS people_in_groups_pkey;
ALTER TABLE IF EXISTS ONLY public.people_groups DROP CONSTRAINT IF EXISTS people_groups_pkey;
ALTER TABLE IF EXISTS ONLY public.devices DROP CONSTRAINT IF EXISTS devices_pkey1;
ALTER TABLE IF EXISTS ONLY public.device_priority DROP CONSTRAINT IF EXISTS device_priority_pkey;
ALTER TABLE IF EXISTS ONLY public.device_notifications DROP CONSTRAINT IF EXISTS device_notifications_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.positions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.people_groups ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.people ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.user_sessions;
DROP VIEW IF EXISTS public.user_device_status;
DROP VIEW IF EXISTS public.user_visible_devices;
DROP TABLE IF EXISTS public.user_device_access;
DROP SEQUENCE IF EXISTS public.positions_id_seq1;
DROP TABLE IF EXISTS public.people_in_groups;
DROP SEQUENCE IF EXISTS public.people_id_seq;
DROP SEQUENCE IF EXISTS public.people_groups_id_seq;
DROP TABLE IF EXISTS public.people_groups;
DROP TABLE IF EXISTS public.people;
DROP VIEW IF EXISTS public.latest_positions;
DROP TABLE IF EXISTS public.positions;
DROP TABLE IF EXISTS public.devices;
DROP TABLE IF EXISTS public.device_priority;
DROP TABLE IF EXISTS public.device_notifications;
DROP FUNCTION IF EXISTS public.assign_devices_to_user(user_id integer, device_ids_csv text);
DROP EXTENSION IF EXISTS unaccent;
--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: assign_devices_to_user(integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.assign_devices_to_user(user_id integer, device_ids_csv text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  device_id TEXT;
BEGIN
  FOREACH device_id IN ARRAY string_to_array(device_ids_csv, ',') LOOP
    INSERT INTO user_device_access (user_id, device_id)
    VALUES (user_id, trim(device_id))
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION public.assign_devices_to_user(user_id integer, device_ids_csv text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: device_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_notifications (
    device_id character varying NOT NULL,
    telegram_token text NOT NULL,
    telegram_channel_id text NOT NULL,
    notify boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.device_notifications OWNER TO postgres;

--
-- Name: device_priority; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.device_priority (
    device_id character varying NOT NULL,
    is_priority boolean DEFAULT false,
    refresh_interval integer DEFAULT 60,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.device_priority OWNER TO postgres;

--
-- Name: devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.devices (
    id character varying NOT NULL,
    name text,
    icon text,
    device_type text,
    person_id integer,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    model text,
    manufacturer text,
    os_type text
);


ALTER TABLE public.devices OWNER TO postgres;

--
-- Name: positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.positions (
    id integer NOT NULL,
    device_id character varying,
    latitude numeric,
    longitude numeric,
    altitude numeric,
    floor_level integer,
    horizontal_accuracy numeric,
    vertical_accuracy numeric,
    position_type text,
    address text,
    city text,
    country text,
    "timestamp" bigint,
    readable_datetime text,
    battery_level numeric,
    battery_status text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.positions OWNER TO postgres;

--
-- Name: latest_positions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.latest_positions AS
 SELECT DISTINCT ON (positions.device_id) positions.id,
    positions.device_id,
    positions.latitude,
    positions.longitude,
    positions.altitude,
    positions.floor_level,
    positions.horizontal_accuracy,
    positions.vertical_accuracy,
    positions.position_type,
    positions.address,
    positions.city,
    positions.country,
    positions."timestamp",
    positions.readable_datetime,
    positions.battery_level,
    positions.battery_status,
    positions.created_at
   FROM public.positions
  WHERE ((positions.latitude IS NOT NULL) AND (positions.longitude IS NOT NULL))
  ORDER BY positions.device_id, positions."timestamp" DESC;


ALTER TABLE public.latest_positions OWNER TO postgres;

--
-- Name: people; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.people (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    picture text
);


ALTER TABLE public.people OWNER TO postgres;

--
-- Name: people_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.people_groups (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.people_groups OWNER TO postgres;

--
-- Name: people_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.people_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.people_groups_id_seq OWNER TO postgres;

--
-- Name: people_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.people_groups_id_seq OWNED BY public.people_groups.id;


--
-- Name: people_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.people_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.people_id_seq OWNER TO postgres;

--
-- Name: people_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.people_id_seq OWNED BY public.people.id;


--
-- Name: people_in_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.people_in_groups (
    person_id integer NOT NULL,
    group_id integer NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.people_in_groups OWNER TO postgres;

--
-- Name: positions_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.positions_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.positions_id_seq1 OWNER TO postgres;

--
-- Name: positions_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.positions_id_seq1 OWNED BY public.positions.id;


--
-- Name: user_device_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_device_access (
    user_id integer NOT NULL,
    device_id character varying NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_device_access OWNER TO postgres;

--
-- Name: user_visible_devices; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.user_visible_devices AS
 SELECT uda.user_id,
    d.id,
    d.name,
    d.icon,
    d.device_type,
    d.person_id,
    d.is_primary,
    d.created_at,
    d.updated_at,
    d.is_active,
    d.model,
    d.manufacturer,
    d.os_type
   FROM (public.user_device_access uda
     JOIN public.devices d ON (((uda.device_id)::text = (d.id)::text)))
  WHERE (d.is_active = true);


ALTER TABLE public.user_visible_devices OWNER TO postgres;

--
-- Name: user_device_status; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.user_device_status AS
 SELECT uvd.user_id,
    uvd.id AS device_id,
    uvd.name AS device_name,
    uvd.icon AS device_icon,
    uvd.device_type,
    uvd.is_primary,
    uvd.person_id,
    p.name AS person_name,
    p.picture AS person_picture,
    lp.latitude,
    lp.longitude,
    lp.readable_datetime,
    lp.battery_level,
    lp.battery_status
   FROM ((public.user_visible_devices uvd
     LEFT JOIN public.people p ON ((p.id = uvd.person_id)))
     LEFT JOIN public.latest_positions lp ON (((uvd.id)::text = (lp.device_id)::text)));


ALTER TABLE public.user_device_status OWNER TO postgres;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password text,
    google_id text,
    is_staff boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    active boolean DEFAULT false,
    default_device_id character varying,
    person_id integer
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: people id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people ALTER COLUMN id SET DEFAULT nextval('public.people_id_seq'::regclass);


--
-- Name: people_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people_groups ALTER COLUMN id SET DEFAULT nextval('public.people_groups_id_seq'::regclass);


--
-- Name: positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions ALTER COLUMN id SET DEFAULT nextval('public.positions_id_seq1'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: device_notifications device_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_notifications
    ADD CONSTRAINT device_notifications_pkey PRIMARY KEY (device_id);


--
-- Name: device_priority device_priority_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_priority
    ADD CONSTRAINT device_priority_pkey PRIMARY KEY (device_id);


--
-- Name: devices devices_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey1 PRIMARY KEY (id);


--
-- Name: people_groups people_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people_groups
    ADD CONSTRAINT people_groups_pkey PRIMARY KEY (id);


--
-- Name: people_in_groups people_in_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people_in_groups
    ADD CONSTRAINT people_in_groups_pkey PRIMARY KEY (person_id, group_id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: positions positions_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey1 PRIMARY KEY (id);


--
-- Name: user_device_access user_device_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_device_access
    ADD CONSTRAINT user_device_access_pkey PRIMARY KEY (user_id, device_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (sid);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_user_sessions_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_user_sessions_expire" ON public.user_sessions USING btree (expire);


--
-- Name: idx_devices_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_devices_active ON public.devices USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_devices_person_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_devices_person_id ON public.devices USING btree (person_id);


--
-- Name: idx_positions_device_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_device_timestamp ON public.positions USING btree (device_id, "timestamp" DESC);


--
-- Name: idx_positions_timestamp_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_timestamp_desc ON public.positions USING btree ("timestamp" DESC);


--
-- Name: device_notifications device_notifications_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_notifications
    ADD CONSTRAINT device_notifications_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: device_priority device_priority_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.device_priority
    ADD CONSTRAINT device_priority_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: devices devices_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: people_in_groups people_in_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people_in_groups
    ADD CONSTRAINT people_in_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.people_groups(id);


--
-- Name: people_in_groups people_in_groups_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.people_in_groups
    ADD CONSTRAINT people_in_groups_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: positions positions_device_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_device_id_fkey1 FOREIGN KEY (device_id) REFERENCES public.devices(id);


--
-- Name: user_device_access user_device_access_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_device_access
    ADD CONSTRAINT user_device_access_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;


--
-- Name: user_device_access user_device_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_device_access
    ADD CONSTRAINT user_device_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_default_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_default_device_id_fkey FOREIGN KEY (default_device_id) REFERENCES public.devices(id);


--
-- Name: users users_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: TABLE device_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.device_notifications TO locator_user;


--
-- Name: TABLE device_priority; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.device_priority TO locator_user;


--
-- Name: TABLE devices; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.devices TO locator_user;


--
-- Name: TABLE positions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.positions TO locator_user;


--
-- Name: TABLE people; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.people TO locator_user;


--
-- Name: TABLE people_groups; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.people_groups TO locator_user;


--
-- Name: SEQUENCE people_groups_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.people_groups_id_seq TO locator_user;


--
-- Name: SEQUENCE people_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.people_id_seq TO locator_user;


--
-- Name: TABLE people_in_groups; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.people_in_groups TO locator_user;


--
-- Name: SEQUENCE positions_id_seq1; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.positions_id_seq1 TO locator_user;


--
-- PostgreSQL database dump complete
--