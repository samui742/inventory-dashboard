insert into public.equipment (
  id, status, assigned_to, display_name, record_date, category, location,
  mfg_part_number, serial_number, quantity, vendor, notes
) values
  (1,'checked-out','tuppayok','Edgar5','2026-08-23','PoE load','Station 1','53-0005-01','123456',1,'Reach',''),
  (2,'infrastructure','','XGS12','2026-08-23','IXIA chassis','Station 2','XGS12-HD16','98765',1,'Keysight',''),
  (3,'available','','Edgar5','2026-08-23','PoE load','Stockroom','53-0005-01','',1,'',''),
  (4,'available','','Edgar5','2026-08-24','PoE load','Stockroom','53-0005-01','',1,'',''),
  (5,'available','','PWR-C1-1900WHV-T','2026-08-25','Power supply','Stockroom','341-101610-01 02','LIT2913AN5U',1,'Liteon',''),
  (6,'available','','PWR-C1-1900WHV-T','2026-08-26','Power supply','Stockroom','341-101610-01 02','LIT2913ANA4',1,'Liteon',''),
  (7,'available','','PWR-C1-1900WHV-T','2026-08-27','Power supply','Stockroom','341-101610-01 02','LIT2913ANA7',1,'Liteon',''),
  (8,'available','','PWR-C1-1900WHV-T','2026-08-28','Power supply','Stockroom','341-101610-01 02','LIT2913AN5V',1,'Liteon',''),
  (9,'available','','PWR-C1-1900WHV-T','2026-08-29','Power supply','Stockroom','341-101610-01 02','LIT2913AN5Y',1,'Liteon',''),
  (10,'available','','PWR-C1-1900WHV-T','2026-08-30','Power supply','Stockroom','341-101610-01 02','LIT2913AN9Y',1,'Liteon',''),
  (11,'available','','PWR-C2-850WAC-I','2026-08-31','Power supply','Stockroom','341-101479-01 03','MEG2911003R',1,'Megmeet',''),
  (12,'available','','PWR-C2-850WAC-I','2026-09-01','Power supply','Stockroom','341-101479-01 03','MEG2911004N',1,'Megmeet',''),
  (13,'available','','PWR-C2-850WAC-I','2026-09-02','Power supply','Stockroom','341-101479-01 03','MEG2911003J',1,'Megmeet',''),
  (14,'available','','PWR-C2-850WAC-I','2026-09-03','Power supply','Stockroom','341-101479-01 03','MEG2911004V',1,'Megmeet',''),
  (15,'available','','PWR-C2-850WAC-I','2026-09-04','Power supply','Stockroom','341-101479-01 03','MEG29110015',1,'Megmeet',''),
  (16,'available','','PWR-C2-850WAC-I','2026-09-05','Power supply','Stockroom','341-101479-01 03','MEG2911001P',1,'Megmeet',''),
  (17,'available','','PWR-C2-850WAC-I','2026-09-06','Power supply','Stockroom','341-101479-01 03','MEG2911004P',1,'Megmeet',''),
  (18,'available','','PWR-C2-850WAC-I','2026-09-07','Power supply','Stockroom','341-101479-01 03','MEG2911001D',1,'Megmeet',''),
  (19,'available','','PWR-C2-850WAC-I','2026-08-23','Power supply','Stockroom','341-101479-01 03','LIT29123355',1,'Liteon','')
on conflict (id) do update set
  status = excluded.status,
  assigned_to = excluded.assigned_to,
  display_name = excluded.display_name,
  record_date = excluded.record_date,
  category = excluded.category,
  location = excluded.location,
  mfg_part_number = excluded.mfg_part_number,
  serial_number = excluded.serial_number,
  quantity = excluded.quantity,
  vendor = excluded.vendor,
  notes = excluded.notes;

select setval(
  pg_get_serial_sequence('public.equipment', 'id'),
  coalesce((select max(id) from public.equipment), 1),
  true
);
