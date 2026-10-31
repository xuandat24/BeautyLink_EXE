select utc_timestamp(6) as as_of_utc,
       date_add(utc_timestamp(6), interval 7 hour) as as_of_vietnam,
       database() as database_name;

select r.period, count(v.id) as canonical_transactions,
       count(distinct v.booking_id) as unique_bookings,
       coalesce(sum(v.amount),0) as verified_online,
       coalesce(sum(case when v.payment_option in ('DEPOSIT_05','DEPOSIT_50') then v.amount else 0 end),0) as deposits,
       coalesce(sum(case when v.payment_option='FULL_100' then v.amount else 0 end),0) as full_payments,
       count(case when v.payment_option in ('DEPOSIT_05','DEPOSIT_50') then v.id end) as deposit_bookings,
       count(case when v.payment_option='FULL_100' then v.id end) as full_bookings
from (select '2026-10-01_31' as period, cast('2026-10-01' as datetime) as start_at
      union all select '2026-10-02_31', cast('2026-10-02' as datetime)) r
left join (
    select p.id,p.booking_id,p.payment_option,p.amount,p.paid_at
    from payment_transactions p
    join bookings b on b.id=p.booking_id
    join user_accounts u on u.id=b.customer_id and u.role='CUSTOMER'
    join suppliers s on s.id=b.supplier_id and s.demo_data=false
    where p.status='PAID' and p.paid_at is not null and p.requires_manual_review=false
      and p.id=(select min(p2.id) from payment_transactions p2
                where p2.booking_id=p.booking_id and p2.status='PAID')
) v on v.paid_at>=r.start_at and v.paid_at<'2026-11-01'
group by r.period order by r.period;

select id,sha2(payload,256) as payload_sha256,
       json_extract(payload,'$.version') as version,
       json_keys(json_extract(payload,'$.data')) as data_keys,
       json_length(json_extract(payload,'$.data.bookings')) as report_bookings,
       json_length(json_extract(payload,'$.data.users')) as report_users
from presentation_recovery where id='beautylink-presentation-20261031';

select count(*) as report_bookings,count(distinct j.id) as unique_booking_ids,
       min(j.total_amount) as min_booking_value,max(j.total_amount) as max_booking_value,
       sum(j.total_amount) as service_value,
       sum(j.simulated_amount) as legacy_simulated_metadata_not_receipts,
       sum(j.verified_amount is not null) as verified_amounts_set,
       sum(mod(j.total_amount,1000)<>0) as non_thousand_vnd_values,
       sum(round(j.total_amount*0.05,0)>=2000) as available_five_percent_deposits,
       sum(o.id is null or s.id is null) as orphan_services_or_suppliers,
       sum(o.supplier_id<>j.supplier_id) as service_supplier_mismatches,
       sum(o.price<>j.total_amount) as historical_valuations_differing_from_catalog
from presentation_recovery r
join json_table(r.payload,'$.data.bookings[*]' columns(
    id bigint path '$.id',supplier_id bigint path '$.supplierId',service_id bigint path '$.serviceId',
    total_amount decimal(12,2) path '$.totalAmount',
    simulated_amount decimal(12,2) path '$.simulatedOnlineAmount' null on empty,
    verified_amount decimal(12,2) path '$.verifiedOnlineAmount' null on empty
)) j
left join service_offerings o on o.id=j.service_id
left join suppliers s on s.id=j.supplier_id
where r.id='beautylink-presentation-20261031';

select count(*) as upper_bound_bookings,
       sum(total_amount) as largest_72_full_payment_total
from (
    select j.id,j.total_amount
    from presentation_recovery r
    join json_table(r.payload,'$.data.bookings[*]' columns(
        id bigint path '$.id',total_amount decimal(12,2) path '$.totalAmount'
    )) j
    where r.id='beautylink-presentation-20261031'
    order by j.total_amount desc,j.id limit 72
) ranked;

select j.total_amount,count(*) as report_bookings,
       round(j.total_amount*0.05,0) as five_percent_deposit,
       round(j.total_amount*0.05,0)>=2000 as deposit_available
from presentation_recovery r
join json_table(r.payload,'$.data.bookings[*]' columns(
    total_amount decimal(12,2) path '$.totalAmount'
)) j
where r.id='beautylink-presentation-20261031'
group by j.total_amount order by j.total_amount;

select min(o.price) as min_price,max(o.price) as max_price,count(*) as active_services,
       sum(mod(o.price,1000)<>0) as non_thousand_vnd_prices
from service_offerings o join suppliers s on s.id=o.supplier_id
where s.demo_data=false and o.active=true;
